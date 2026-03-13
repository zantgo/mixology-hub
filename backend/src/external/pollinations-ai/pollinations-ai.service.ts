import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IAiProvider } from './ai-provider.interface';

@Injectable()
export class PollinationsAiService implements IAiProvider {
  private readonly logger = new Logger(PollinationsAiService.name);

  constructor(private readonly httpService: HttpService) {}

  async generateRecipe(ingredients: string[]) {
    // Simplificamos el prompt para evitar conflictos en la URL
    const prompt = `Create a cocktail with ${ingredients.join(', ')}. Return JSON: name, ingredients (array), instructions.`;
    
    // Usamos el endpoint de texto directo
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?json=true`;

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      const data = response.data;
      
      // Si recibimos un string, parseamos; si es objeto, lo devolvemos
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (error) {
      this.logger.error('Error calling Pollinations AI:', error.response?.data || error.message);
      throw new Error('Failed to generate recipe from AI service');
    }
  }
}
