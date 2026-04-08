import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { IAiProvider, AiGenerationOptions, AiRecipe } from '../ai-provider.interface';

@Injectable()
export class LlmAdapterService implements IAiProvider {
  private readonly logger = new Logger(LlmAdapterService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  async generateRecipe(ingredients: string[], options?: AiGenerationOptions): Promise<AiRecipe> {
    const apiUrl = this.configService.get<string>('AI_API_URL');
    const apiKey = this.configService.get<string>('AI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL') || 'deepseek-chat';

    if (!apiUrl || !apiKey) {
       this.logger.error('AI Configuration missing in .env');
       throw new BadGatewayException('AI Service is not configured.');
    }

    const theme = options?.theme ? ` with a ${options.theme} theme` : '';
    const difficulty = options?.difficulty ? ` suitable for ${options.difficulty} skill level` : '';
    const language = options?.language || 'English';
    
    const prompt = `Act as a professional bartender. Create a cocktail${theme}${difficulty} using ONLY these ingredients: ${ingredients.join(', ')}. 
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
        this.httpService.post(apiUrl, {
          model: model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: options?.maxTokens || 1000,
          temperature: options?.temperature || 0.7,
        }, {
          headers: { Authorization: `Bearer ${apiKey}` }
        })
      );

      const rawContent = response.data.choices[0].message.content;
      const recipe = JSON.parse(rawContent.replace(/```json/g, '').replace(/```/g, '').trim());
      
      // Validate the recipe structure
      const validation = await this.validateContent(JSON.stringify(recipe));
      if (!validation.isValid) {
        throw new BadGatewayException(`Generated recipe failed validation: ${validation.issues.join(', ')}`);
      }

      return recipe;

    } catch (error) {
      this.logger.error('Failed to generate AI recipe', error.message);
      throw new BadGatewayException('LLM Provider failed to generate recipe.');
    }
  }

  async validateContent(content: string): Promise<{ isValid: boolean; issues: string[] }> {
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
      harmfulPatterns.forEach(pattern => {
        if (pattern.test(contentString)) {
          issues.push(`Content contains potentially harmful pattern: ${pattern.source}`);
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
        issues
      };
      
    } catch (error) {
      return {
        isValid: false,
        issues: [`Invalid JSON format: ${error.message}`]
      };
    }
  }

  getModelInfo(): { name: string; version: string; capabilities: string[] } {
    const model = this.configService.get<string>('AI_MODEL') || 'deepseek-chat';
    const apiUrl = this.configService.get<string>('AI_API_URL') || '';
    
    // Determine provider based on API URL
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
        'theme-customization'
      ]
    };
  }
}