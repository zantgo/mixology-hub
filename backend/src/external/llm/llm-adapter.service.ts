import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { IAiProvider } from '../ai-provider.interface';

@Injectable()
export class LlmAdapterService implements IAiProvider {
  private readonly logger = new Logger(LlmAdapterService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  async generateRecipe(ingredients: string[]) {
    const apiUrl = this.configService.get<string>('AI_API_URL');
    const apiKey = this.configService.get<string>('AI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL') || 'deepseek-chat';

    if (!apiUrl || !apiKey) {
       this.logger.error('AI Configuration missing in .env');
       throw new BadGatewayException('AI Service is not configured.');
    }

    const prompt = `Act as a professional bartender. Create a cocktail using ONLY these ingredients: ${ingredients.join(', ')}. Return ONLY a raw JSON object with this structure: {"name": "string", "ingredients": [{"name": "string", "measure": "string"}], "instructions": "string"}`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(apiUrl, {
          model: model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        }, {
          headers: { Authorization: `Bearer ${apiKey}` }
        })
      );

      const rawContent = response.data.choices[0].message.content;
      return JSON.parse(rawContent.replace(/```json/g, '').replace(/```/g, '').trim());

    } catch (error) {
      this.logger.error('Failed to generate AI recipe', error.message);
      throw new BadGatewayException('LLM Provider failed to generate recipe.');
    }
  }
}