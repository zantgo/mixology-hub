import { Injectable, Logger } from '@nestjs/common';
import { CocktailsService } from './cocktails.service';
import { TheCocktailDbService } from '../external/the-cocktail-db/the-cocktail-db.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class CocktailAggregatorService {
  private readonly logger = new Logger(CocktailAggregatorService.name);

  constructor(
    private readonly localService: CocktailsService,
    private readonly externalService: TheCocktailDbService,
  ) {}

  /**
   * Searches both local DB and TheCocktailDB, normalizes, and paginates the output.
   */
  async searchUnified(name: string, paginationQuery: PaginationQueryDto) {
    try {
      const { limit = 10, offset = 0 } = paginationQuery;

      // 1. Fetch Local Data (Using a high limit internally to allow manual filtering)
      const localResponse = await this.localService.findAll({ limit: 10000, offset: 0 });
      const localCocktails = localResponse.data;
      
      const filteredLocal = localCocktails.filter(c => 
        c.name.toLowerCase().includes(name.toLowerCase())
      );
      
      // 2. Fetch External Data
      let externalCocktails =[];
      try {
        externalCocktails = await this.externalService.searchByName(name);
      } catch (err) {
        this.logger.warn('External API failed, returning only local data.');
      }

      // 3. Normalize External Data (Mapper Pattern)
      const normalizedExternal = Array.isArray(externalCocktails) 
        ? externalCocktails.map(drink => this.mapExternalToLocal(drink))
        : [];

      // 4. Combine and Apply Pagination
      const unifiedList =[...filteredLocal, ...normalizedExternal];
      const paginatedList = unifiedList.slice(offset, offset + limit);

      return {
        data: paginatedList,
        total: unifiedList.length,
        limit,
        offset,
      };

    } catch (err) {
      this.logger.error('Search unified failed:', err);
      // Return an empty structure while respecting the pagination format
      return { data:[], total: 0, limit: paginationQuery.limit || 10, offset: paginationQuery.offset || 0 };
    }
  }

  /**
   * Maps TheCocktailDB dirty JSON to our strict internal TypeORM format.
   */
  private mapExternalToLocal(drink: any) {
    const ingredients:any[] =[];
    
    // TheCocktailDB uses strIngredient1 up to 15
    for (let i = 1; i <= 15; i++) {
      const ingredientName = drink[`strIngredient${i}`];
      const measure = drink[`strMeasure${i}`];
      
      if (ingredientName && ingredientName.trim() !== '') {
        ingredients.push({
          measure: measure ? measure.trim() : 'to taste',
          ingredient: {
            id: `ext-${i}-${drink.idDrink}`, 
            name: ingredientName.trim().toLowerCase(),
          }
        });
      }
    }

    return {
      id: drink.idDrink, 
      name: drink.strDrink,
      description: 'Public recipe from TheCocktailDB',
      instructions: drink.strInstructions,
      is_public: true,
      source: 'api',
      external_id: drink.idDrink,
      ingredients: ingredients
    };
  }
}
