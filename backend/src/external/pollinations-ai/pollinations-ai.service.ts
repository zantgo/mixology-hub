import { Injectable, Logger, InternalServerErrorException, BadGatewayException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IAiProvider } from './ai-provider.interface';

@Injectable()
export class PollinationsAiService implements IAiProvider {
  private readonly logger = new Logger(PollinationsAiService.name);

  constructor(private readonly httpService: HttpService) {}

   async generateRecipe(ingredients: string[]) {
    // STRICT PROMPT
    const prompt = `
      Act as a professional bartender. 
      Create a cocktail using ONLY these ingredients: ${ingredients.join(', ')}. 
      Return ONLY a JSON object with this exact structure:
      {
        "name": "string",
        "ingredients":[
          { "name": "string", "measure": "string" }
        ],
        "instructions": "string"
      }
      No markdown, no backticks, just the raw JSON.
    `;
    
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?json=true`;
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await firstValueFrom(this.httpService.get(url));
        let rawData = response.data;
        
        if (typeof rawData === 'string') {
          // Clean up possible Markdown markers that the AI insists on including
          rawData = rawData.replace(/```json/g, '').replace(/```/g, '').trim();
          rawData = JSON.parse(rawData);
        }

        // Basic validation of expected structure
        if (!rawData || typeof rawData !== 'object' || !rawData.name || !Array.isArray(rawData.ingredients)) {
          throw new Error('Invalid JSON structure returned by AI');
        }

        return rawData;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Attempt ${attempt} failed to generate recipe: ${error.message}`);
        
        // Short wait before next retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    this.logger.error('Error calling Pollinations AI after max retries:', lastError.message);
    throw new BadGatewayException('The AI service failed to provide a valid recipe after multiple attempts.');
  }
}
