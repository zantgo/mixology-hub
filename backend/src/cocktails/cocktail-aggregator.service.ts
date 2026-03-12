import { Injectable } from '@nestjs/common';
import { CocktailsService } from './cocktails.service';
import { TheCocktailDbService } from '../external/the-cocktail-db/the-cocktail-db.service';

@Injectable()
export class CocktailAggregatorService {
  constructor(
    private readonly localService: CocktailsService,
    private readonly externalService: TheCocktailDbService,
  ) {}

  async searchUnified(name: string) {
    // 1. Buscar en BD local
    const localCocktails = await this.localService.findAll(); // Aquí deberías filtrar por nombre en el futuro
    
    // 2. Buscar en API externa
    const externalCocktails = await this.externalService.searchByName(name);

    // 3. Normalizar y combinar (esto es el núcleo del Patrón Adapter)
    const normalizedExternal = externalCocktails.map((drink: any) => ({
      id: drink.idDrink,
      name: drink.strDrink,
      description: 'Public recipe from TheCocktailDB',
      instructions: drink.strInstructions,
      is_public: true,
      ingredients: [], // Mapear ingredientes externos sería el siguiente nivel
      source: 'api'
    }));

    return [...localCocktails, ...normalizedExternal];
  }
}
