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
    // 1. Buscar en BD local (Implementaremos filtro básico en el servicio local)
    const localCocktails = await this.localService.findAll();
    const filteredLocal = localCocktails.filter(c => 
      c.name.toLowerCase().includes(name.toLowerCase())
    );
    
    // 2. Buscar en API externa
    const externalCocktails = await this.externalService.searchByName(name);

    // 3. Normalizar y combinar (Verificamos que sea un array para evitar errores)
    const normalizedExternal = Array.isArray(externalCocktails) 
      ? externalCocktails.map((drink: any) => ({
          id: drink.idDrink,
          name: drink.strDrink,
          description: 'Public recipe from TheCocktailDB',
          instructions: drink.strInstructions,
          is_public: true,
          ingredients: [], 
          source: 'api'
        }))
      : [];

    return [...filteredLocal, ...normalizedExternal];
  }
}
