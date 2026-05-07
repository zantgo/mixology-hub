import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  IAiProvider,
  AiGenerationOptions,
  AiRecipe,
} from '../ai-provider.interface';

@Injectable()
export class LlmAdapterService implements IAiProvider {
  private readonly logger = new Logger(LlmAdapterService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async generateRecipe(
    ingredients: string[],
    options?: AiGenerationOptions,
  ): Promise<AiRecipe> {
    const apiUrl = this.configService.get<string>('AI_API_URL');
    const apiKey = this.configService.get<string>('AI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL') || 'deepseek-chat';

    if (!apiUrl || !apiKey) {
      this.logger.error('AI Configuration missing in .env');
      throw new BadGatewayException('AI Service is not configured.');
    }

    // Sanitize each ingredient against prompt injection
    const sanitizedIngredients = ingredients.map((ing) =>
      this.sanitizeUserInput(ing),
    );

    const theme = options?.theme
      ? ` with a ${this.sanitizeUserInput(options.theme)} theme`
      : '';
    const difficulty = options?.difficulty
      ? ` suitable for ${options.difficulty} skill level`
      : '';
    const language = options?.language || 'English';

    const prompt = `Act as a professional bartender. Create a cocktail${theme}${difficulty} using ONLY these ingredients: ${sanitizedIngredients.join(', ')}. 
    Return ONLY a raw JSON object with this structure: {
      "name": "string",
      "description": "string",
      "instructions": ["step1", "step2", ...],
      "ingredients": [{"name": "string", "amount": number, "unit": "string", "note": "optional string"}],
      "metadata": {
        "difficulty": "easy|medium|hard",
        "preparationTime": "string",
        "servingSize": number,
        "theme": "optional string"
      }
    }`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          apiUrl,
          {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            max_tokens: options?.maxTokens || 1000,
            temperature: options?.temperature || 0.7,
          },
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          },
        ),
      );

      const rawContent = response.data.choices[0].message.content;

      if (!rawContent) {
        throw new BadGatewayException('LLM returned an empty or blocked response.');
      }

      // Robust JSON extraction: find from first '{' to last '}'
      const startIdx = rawContent.indexOf('{');
      const endIdx = rawContent.lastIndexOf('}');
      if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
        throw new BadGatewayException(
          'LLM response does not contain valid JSON',
        );
      }
      const jsonString = rawContent.substring(startIdx, endIdx + 1);
      const recipe = JSON.parse(jsonString);

      // Validate the recipe structure
      const validation = await this.validateContent(JSON.stringify(recipe));
      if (!validation.isValid) {
        throw new BadGatewayException(
          `Generated recipe failed validation: ${validation.issues.join(', ')}`,
        );
      }

      return recipe;
    } catch (error) {
      this.logger.error('Failed to generate AI recipe', error.message);
      throw new BadGatewayException('LLM Provider failed to generate recipe.');
    }
  }

  async validateContent(
    content: string,
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const parsed = JSON.parse(content);

      // Check for harmful content patterns
      const harmfulPatterns = [
        /alcohol abuse/i,
        /underage drinking/i,
        /excessive consumption/i,
        /dangerous combination/i,
        /illegal substance/i,
        /hate speech/i,
        /violence/i,
        /self-harm/i,
      ];

      const contentString = JSON.stringify(parsed).toLowerCase();
      harmfulPatterns.forEach((pattern) => {
        if (pattern.test(contentString)) {
          issues.push(
            `Content contains potentially harmful pattern: ${pattern.source}`,
          );
        }
      });

      // Validate recipe structure
      if (!parsed.name || typeof parsed.name !== 'string') {
        issues.push('Recipe name is missing or invalid');
      }

      if (!parsed.ingredients || !Array.isArray(parsed.ingredients)) {
        issues.push('Ingredients array is missing or invalid');
      } else {
        parsed.ingredients.forEach((ing: any, index: number) => {
          if (!ing.name || typeof ing.name !== 'string') {
            issues.push(`Ingredient ${index + 1} name is missing or invalid`);
          }
          if (!ing.amount || typeof ing.amount !== 'number') {
            issues.push(`Ingredient ${index + 1} amount is missing or invalid`);
          }
          if (!ing.unit || typeof ing.unit !== 'string') {
            issues.push(`Ingredient ${index + 1} unit is missing or invalid`);
          }
        });
      }

      if (!parsed.instructions || !Array.isArray(parsed.instructions)) {
        issues.push('Instructions array is missing or invalid');
      }

      // Check for hallucinated ingredients (ingredients not in the provided list)
      // This would require comparing with the original ingredients list,
      // but we don't have access to it here. The AI service should handle this.

      return {
        isValid: issues.length === 0,
        issues,
      };
    } catch (error) {
      return {
        isValid: false,
        issues: [`Invalid JSON format: ${error.message}`],
      };
    }
  }

  getModelInfo(): { name: string; version: string; capabilities: string[] } {
    const model = this.configService.get<string>('AI_MODEL') || 'deepseek-chat';
    const apiUrl = this.configService.get<string>('AI_API_URL') || '';

    let provider = 'Generic LLM';
    if (apiUrl.includes('openai')) provider = 'OpenAI';
    else if (apiUrl.includes('anthropic')) provider = 'Anthropic';
    else if (apiUrl.includes('deepseek')) provider = 'DeepSeek';

    return {
      name: model,
      version: '1.0',
      capabilities: [
        'recipe-generation',
        'content-moderation',
        'json-output',
        'multi-language',
        'theme-customization',
        'tool-calling',
      ],
    };
  }

  /**
   * Generate a recipe using MCP-style tool calling.
   * The LLM receives tool definitions and can call them during generation.
   * @param ingredients User-provided ingredient names
   * @param tools Tool definitions in OpenAI function-calling format
   * @param toolExecutor Callback that executes tool calls and returns results
   * @param options Generation options
   */
  async generateWithTools(
    ingredients: string[],
    tools: Array<{
      type: 'function';
      function: { name: string; description: string; parameters: any };
    }>,
    toolExecutor: (toolName: string, args: any) => Promise<any>,
    options?: AiGenerationOptions,
  ): Promise<AiRecipe> {
    const apiUrl = this.configService.get<string>('AI_API_URL');
    const apiKey = this.configService.get<string>('AI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL') || 'deepseek-chat';

    if (!apiUrl || !apiKey) {
      throw new BadGatewayException('AI Service is not configured.');
    }

    const sanitized = ingredients.map((i) => this.sanitizeUserInput(i));
    const theme = options?.theme
      ? ` with a ${this.sanitizeUserInput(options.theme)} theme`
      : '';
    const modifiers = options?.modifiers?.length
      ? ` Style notes: ${options.modifiers.map((m) => this.sanitizeUserInput(m)).join(', ')}.`
      : '';
    const unitHint =
      options?.unitSystem === 'imperial'
        ? ' Use imperial units (oz, tbsp, tsp) for measurements.'
        : options?.unitSystem === 'metric'
          ? ' Use metric units (ml, cl) for measurements.'
          : '';
    const language = options?.language || 'English';

    const systemPrompt = `Act as a professional bartender. Create a cocktail${theme} using the user's bar inventory.${modifiers}${unitHint}
You have access to tools to check inventory, search for recipes, and convert units.
Use the tools as needed, then respond with a complete cocktail recipe as a raw JSON object.
Return ONLY a raw JSON object: {"name":"string","description":"string","instructions":["step1"],"ingredients":[{"name":"string","amount":number,"unit":"string","note":"optional"}],"metadata":{"difficulty":"easy|medium|hard","preparationTime":"string","servingSize":number}}`;

    const userMessage = `Create a cocktail using these available ingredients: ${sanitized.join(', ')}. Respond in ${language}.`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const MAX_RESPONSE_SIZE = 50 * 1024;

    try {
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      const response = await firstValueFrom(
        this.httpService.post(
          apiUrl,
          {
            model,
            messages,
            tools,
            tool_choice: 'auto',
            max_tokens: options?.maxTokens || 2000,
            temperature: options?.temperature || 0.7,
          },
          { headers, maxContentLength: MAX_RESPONSE_SIZE },
        ),
      );

      const choice = response.data.choices[0];
      const message = choice.message;

      // Handle tool calls loop
      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push(message);

        for (const tc of message.tool_calls) {
          const toolName = tc.function.name;
          const args = JSON.parse(tc.function.arguments);
          const toolResult = await toolExecutor(toolName, args);

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(toolResult),
          });
        }

        // Get final response after tool calls
        const followUpResponse = await firstValueFrom(
          this.httpService.post(
            apiUrl,
            {
              model,
              messages,
              max_tokens: options?.maxTokens || 2000,
              temperature: options?.temperature || 0.7,
            },
            { headers },
          ),
        );

        const finalChoice = followUpResponse.data.choices[0];
        const finalContent = finalChoice.message.content;
        return this.extractRecipeJson(finalContent);
      }

      // No tool calls — direct response
      return this.extractRecipeJson(message.content);
    } catch (error: any) {
      this.logger.error(
        'Failed to generate AI recipe with tools',
        error.message,
      );
      throw new BadGatewayException('LLM Provider failed to generate recipe.');
    }
  }

  private extractRecipeJson(rawContent: string): AiRecipe {
    if (!rawContent) {
      throw new BadGatewayException('LLM returned an empty or blocked response.');
    }
    const startIdx = rawContent.indexOf('{');
    const endIdx = rawContent.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
      throw new BadGatewayException('LLM response does not contain valid JSON');
    }
    return JSON.parse(rawContent.substring(startIdx, endIdx + 1));
  }

  private sanitizeUserInput(input: string): string {
    const MAX_LENGTH = 500;
    const truncated = input.slice(0, MAX_LENGTH);

    // Character whitelisting: allow alphanumeric (incl. unicode letters), spaces, and common recipe punctuation
    const sanitized = truncated.replace(/[^\p{L}\p{N}\s,.\-'/&%()]/gu, '');

    // Block known prompt injection patterns
    const blockedPatterns = [
      /ignore.*previous.*instructions/i,
      /system.*prompt/i,
      /output.*template/i,
      /disregard.*previous/i,
      /respond\s+in\s+plain\s+text/i,
      /forget\s+your\s+instructions/i,
      /you\s+are\s+now/i,
      /new\s+system\s+prompt/i,
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(sanitized)) {
        throw new BadGatewayException('Input contains blocked patterns');
      }
    }

    return sanitized.trim();
  }
}
