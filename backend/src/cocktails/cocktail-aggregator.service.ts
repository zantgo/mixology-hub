import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Decimal } from 'decimal.js';
import { CocktailsService } from './cocktails.service';
import { EnhancedTheCocktailDbService } from '../external/the-cocktail-db/enhanced-cocktail-db.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UserInventoryService } from '../users/user-inventory.service';

export interface SearchFilters {
  ingredient?: string;
  category?: string;
  alcoholic?: boolean;
  glassType?: string;
  maxIngredients?: number;
  minIngredients?: number;
}

export interface SearchOptions {
  includeExternal?: boolean;
  includeLocal?: boolean;
  includeAI?: boolean;
  sortBy?: 'name' | 'popularity' | 'makeability' | 'complexity';
  sortOrder?: 'asc' | 'desc';
  filters?: SearchFilters;
}

@Injectable()
export class CocktailAggregatorService {
  private readonly logger = new Logger(CocktailAggregatorService.name);

  constructor(
    private readonly localService: CocktailsService,
    private readonly externalService: EnhancedTheCocktailDbService,
    private readonly inventoryService: UserInventoryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Enhanced unified search with filters, sorting, and makeability scoring.
   */
  async searchUnified(
    name: string, 
    paginationQuery: PaginationQueryDto,
    options: SearchOptions = {},
    userId?: string,
  ) {
    try {
      const { limit = 10, page = 1 } = paginationQuery;
      const offset = (page - 1) * limit;

      // Validate and sanitize inputs
      if (name && name.trim().length > 100) {
        throw new BadRequestException('Search query too long');
      }

      const sanitizedName = name ? name.trim() : '';

      // Generate cache key for this search
      const cacheKey = this.generateSearchCacheKey(sanitizedName, options, userId);
      
      // Try to get cached results
      let cachedResults = await this.cacheManager.get<any[]>(`search:${cacheKey}`);
      
      if (!cachedResults) {
        // Cache miss - fetch fresh data
        cachedResults = await this.fetchSearchResults(sanitizedName, options, userId);
        // Cache results for 5 minutes
        await this.cacheManager.set(`search:${cacheKey}`, cachedResults, 300000);
      }

      // Apply pagination
      const paginatedList = cachedResults.slice(offset, offset + limit);
      const totalItems = cachedResults.length;
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;

      // 7. Add metadata
      // Count local vs external cocktails in the paginated results
      const localCount = paginatedList.filter(item => item.source === 'local').length;
      const externalCount = paginatedList.filter(item => item.source === 'api').length;
      
      const metadata = {
        sources: {
          local: localCount,
          external: externalCount,
          total: totalItems,
        },
        filters: options.filters || {},
        sort: {
          by: options.sortBy || 'name',
          order: options.sortOrder || 'asc',
        },
      };

      return {
        data: paginatedList,
        meta: {
          currentPage: page,
          nextPage: hasNextPage ? page + 1 : null,
          itemsPerPage: limit,
          totalItems: totalItems,
          totalPages: totalPages
        },
        metadata,
      };

    } catch (err) {
      this.logger.error('Enhanced search unified failed:', err);
      
      // Graceful degradation: return empty results with error info
      const { limit = 10, page = 1 } = paginationQuery;
      return { 
        data: [], 
        meta: {
          currentPage: page,
          nextPage: null,
          itemsPerPage: limit,
          totalItems: 0,
          totalPages: 0
        },
        metadata: {
          error: 'Search failed',
          sources: { local: 0, external: 0, total: 0 },
        },
      };
    }
  }



  private applyFilters(cocktails: any[], filters: SearchFilters): any[] {
    return cocktails.filter(cocktail => {
      // Ingredient filter
      if (filters.ingredient) {
        const normalizedFilter = filters.ingredient.toLowerCase().trim();
        const hasIngredient = cocktail.ingredients.some((ing: any) => {
          const ingName = ing.ingredient?.name as string | undefined;
          return ingName && ingName.toLowerCase().trim().includes(normalizedFilter);
        });
        if (!hasIngredient) return false;
      }

      // Alcoholic filter
      if (filters.alcoholic !== undefined) {
        // This would require additional data from external API
        // For now, skip this filter if we don't have the data
      }

      // Glass type filter
      if (filters.glassType) {
        // This would require additional data from external API
        // For now, skip this filter if we don't have the data
      }

      // Ingredient count filters
      if (filters.minIngredients !== undefined || filters.maxIngredients !== undefined) {
        const ingredientCount = cocktail.ingredients.length;
        if (filters.minIngredients !== undefined && ingredientCount < filters.minIngredients) {
          return false;
        }
        if (filters.maxIngredients !== undefined && ingredientCount > filters.maxIngredients) {
          return false;
        }
      }

      return true;
    });
  }

  private async calculateMakeabilityScores(cocktails: any[], userId: string): Promise<any[]> {
    try {
      const inventory = await this.inventoryService.getInventory(userId);
      
      return cocktails.map(cocktail => {
        const makeabilityScore = this.calculateMakeabilityScore(cocktail, inventory);
        return {
          ...cocktail,
          makeabilityScore,
          isMakeable: makeabilityScore >= 0.8, // 80% threshold
        };
      });
    } catch (error) {
      this.logger.warn('Failed to calculate makeability scores:', error);
      return cocktails.map(cocktail => ({
        ...cocktail,
        makeabilityScore: 0,
        isMakeable: false,
      }));
    }
  }

  private calculateMakeabilityScore(cocktail: any, inventory: any[]): number {
    if (!cocktail.ingredients || cocktail.ingredients.length === 0) {
      return 0;
    }

    let matchedIngredients = 0;
    
    for (const cocktailIngredient of cocktail.ingredients) {
      const requiredIngredient = cocktailIngredient.ingredient;
      
      // Check for direct match (ID first, then normalized name comparison)
      const requiredName = requiredIngredient.name.toLowerCase().trim();
      const directMatch = inventory.find(item => 
        item.ingredient.id === requiredIngredient.id ||
        item.ingredient.name.toLowerCase().trim() === requiredName
      );
      
      if (directMatch) {
        matchedIngredients++;
        continue;
      }

      // Check for hierarchical match (would need ingredient hierarchy data)
      // For now, we'll skip this advanced matching
    }

    return matchedIngredients / cocktail.ingredients.length;
  }

  private sortCocktails(cocktails: any[], sortBy?: string, sortOrder?: string): any[] {
    const order = sortOrder === 'desc' ? -1 : 1;
    
    return [...cocktails].sort((a, b) => {
      switch (sortBy) {
        case 'makeability':
          const scoreA = a.makeabilityScore || 0;
          const scoreB = b.makeabilityScore || 0;
          return (scoreB - scoreA) * order;
          
        case 'complexity':
          const complexityA = a.ingredients?.length || 0;
          const complexityB = b.ingredients?.length || 0;
          return (complexityB - complexityA) * order;
          
        case 'popularity':
          // Placeholder - would need popularity data
          return 0;
          
        case 'name':
        default:
          const nameA = a.name?.toLowerCase() || '';
          const nameB = b.name?.toLowerCase() || '';
          return nameA.localeCompare(nameB) * order;
      }
    });
  }

  /**
   * Enhanced mapper with validation and additional metadata.
   */
  private async mapExternalToLocal(drink: any) {
    if (!drink || !drink.idDrink || !drink.strDrink) {
      return null;
    }

    const ingredients: any[] = [];
    let totalVolumeMl = new Decimal(0);
    
    // TheCocktailDB uses strIngredient1 up to 15
    for (let i = 1; i <= 15; i++) {
      const ingredientName = drink[`strIngredient${i}`];
      const measure = drink[`strMeasure${i}`];
      
      if (ingredientName && ingredientName.trim() !== '') {
        const parsedMeasure = this.parseMeasure(measure);
        
        ingredients.push({
          measure: measure ? measure.trim() : 'to taste',
          amount: parsedMeasure.amount,
          unit: parsedMeasure.unit,
          ingredient: {
            id: `ext-${drink.idDrink}-${i}`, 
            name: ingredientName.trim().toLowerCase(),
            externalId: `thecocktaildb:${ingredientName.trim().toLowerCase()}`,
          }
        });

        // Estimate total volume (for complexity scoring)
        if (parsedMeasure.unit === 'ml' || parsedMeasure.unit === 'oz') {
          const ozToMl = new Decimal(29.57);
          const amount = new Decimal(parsedMeasure.amount);
          totalVolumeMl = totalVolumeMl.plus(
            parsedMeasure.unit === 'oz' ? amount.times(ozToMl) : amount
          );
        }
      }
    }

    // Calculate complexity score
    const complexityScore = this.calculateComplexityScore(ingredients.length, totalVolumeMl.toNumber());

    // ADR 0016: Complete Image Blackout During External Search
    // Images are null for external results; only downloaded on "Save as Custom Cocktail"
    const imageFull: string | null = null;
    const imageThumb: string | null = null;

    return {
      id: `ext-${drink.idDrink}`,
      externalId: drink.idDrink,
      name: drink.strDrink,
      description: drink.strInstructions ? `Public recipe from TheCocktailDB: ${drink.strInstructions.substring(0, 100)}...` : 'Public recipe from TheCocktailDB',
      instructions: drink.strInstructions || 'No instructions provided',
      is_public: true,
      source: 'api',
      image_full: imageFull,
      image_thumb: imageThumb,
      category: drink.strCategory || null,
      alcoholic: drink.strAlcoholic === 'Alcoholic',
      glass: drink.strGlass || null,
      tags: drink.strTags ? drink.strTags.split(',') : [],
      ingredients: ingredients,
      metadata: {
        complexityScore,
        ingredientCount: ingredients.length,
        estimatedVolumeMl: totalVolumeMl.round().toNumber(),
        lastUpdated: new Date().toISOString(),
        source: 'thecocktaildb',
      }
    };
  }

  private parseMeasure(measure: string): { amount: number; unit: string } {
    if (!measure) {
      return { amount: 1, unit: 'parts' };
    }

    const measureStr = measure.trim().toLowerCase();

    // Handle mixed fractions: "1 1/2 oz"
    const mixedFractionMatch = measureStr.match(/^(\d+)\s+(\d+)\/(\d+)\s*(.+)$/);
    if (mixedFractionMatch) {
      const whole = new Decimal(mixedFractionMatch[1]);
      const num = new Decimal(mixedFractionMatch[2]);
      const den = new Decimal(mixedFractionMatch[3]);
      const unit = mixedFractionMatch[4].trim();
      return { amount: whole.plus(num.div(den)).toNumber(), unit };
    }

    // Handle simple fractions: "3/4 oz"
    const fractionMatch = measureStr.match(/^(\d+)\/(\d+)\s*(.+)$/);
    if (fractionMatch) {
      const num = new Decimal(fractionMatch[1]);
      const den = new Decimal(fractionMatch[2]);
      const unit = fractionMatch[3].trim();
      return { amount: num.div(den).toNumber(), unit };
    }

    // Common patterns for decimal amounts
    const patterns = [
      { regex: /(\d+(?:\.\d+)?)\s*ml/, unit: 'ml' },
      { regex: /(\d+(?:\.\d+)?)\s*oz/, unit: 'oz' },
      { regex: /(\d+(?:\.\d+)?)\s*cl/, unit: 'cl' },
      { regex: /(\d+(?:\.\d+)?)\s*dash(?:es)?/, unit: 'dashes' },
      { regex: /(\d+(?:\.\d+)?)\s*drop(?:s)?/, unit: 'drops' },
      { regex: /(\d+(?:\.\d+)?)\s*splash(?:es)?/, unit: 'splashes' },
      { regex: /(\d+(?:\.\d+)?)\s*part(?:s)?/, unit: 'parts' },
      { regex: /(\d+(?:\.\d+)?)\s*slice(?:s)?/, unit: 'slices' },
      { regex: /(\d+(?:\.\d+)?)\s*wedge(?:s)?/, unit: 'wedges' },
      { regex: /(\d+(?:\.\d+)?)\s*twist(?:s)?/, unit: 'twists' },
      { regex: /(\d+(?:\.\d+)?)\s*sprig(?:s)?/, unit: 'sprigs' },
      { regex: /(\d+(?:\.\d+)?)\s*leaf(?:ves)?/, unit: 'leaves' },
    ];

    for (const pattern of patterns) {
      const match = measureStr.match(pattern.regex);
      if (match) {
        return { amount: new Decimal(match[1]).toNumber(), unit: pattern.unit };
      }
    }

    // Default to parts if it's just a number
    const numberMatch = measureStr.match(/(\d+(?:\.\d+)?)/);
    if (numberMatch) {
      return { amount: new Decimal(numberMatch[1]).toNumber(), unit: 'parts' };
    }

    // Default values for descriptive measures
    if (measureStr.includes('pinch') || measureStr.includes('dash')) {
      return { amount: 1, unit: 'dashes' };
    }
    if (measureStr.includes('splash')) {
      return { amount: 1, unit: 'splashes' };
    }
    if (measureStr.includes('to taste') || measureStr.includes('garnish')) {
      return { amount: 1, unit: 'count' };
    }

    return { amount: 1, unit: 'parts' };
  }

  private calculateComplexityScore(ingredientCount: number, totalVolumeMl: number): number {
    // Simple complexity scoring algorithm
    let score = 0;
    
    // Based on ingredient count
    if (ingredientCount <= 3) score += 1;
    else if (ingredientCount <= 5) score += 2;
    else if (ingredientCount <= 7) score += 3;
    else score += 4;
    
    // Based on total volume (proxy for preparation time)
    if (totalVolumeMl > 200) score += 1;
    if (totalVolumeMl > 300) score += 1;
    
    // Normalize to 0-5 scale
    return Math.min(5, score);
  }

  private generateSearchCacheKey(
    name: string, 
    options: SearchOptions, 
    userId?: string
  ): string {
    const keyParts = [
      'search',
      name || 'all',
      options.includeLocal ? 'local' : '',
      options.includeExternal ? 'external' : '',
      options.sortBy || 'name',
      options.sortOrder || 'asc',
      userId || 'anonymous',
      JSON.stringify(options.filters || {}),
    ];
    
    return keyParts.filter(part => part).join(':');
  }

  private async fetchSearchResults(
    name: string,
    options: SearchOptions,
    userId?: string
  ): Promise<any[]> {
    // 1. Fetch data from all sources in parallel
    const [localCocktails, externalCocktails] = await Promise.all([
      options.includeLocal !== false ? this.fetchLocalCocktails(name) : Promise.resolve([]),
      options.includeExternal !== false ? this.fetchExternalCocktails(name) : Promise.resolve([]),
    ]);

    // 2. Normalize and combine
    const normalizedExternal = Array.isArray(externalCocktails) 
      ? (await Promise.all(externalCocktails.map(drink => this.mapExternalToLocal(drink)))).filter(Boolean)
      : [];

    let unifiedList = [...localCocktails, ...normalizedExternal];

    // 3. Apply filters
    if (options.filters) {
      unifiedList = this.applyFilters(unifiedList, options.filters);
    }

    // 4. Calculate makeability scores if user ID provided
    if (userId) {
      unifiedList = await this.calculateMakeabilityScores(unifiedList, userId);
    }

    // 5. Sort results
    unifiedList = this.sortCocktails(unifiedList, options.sortBy, options.sortOrder);

    return unifiedList;
  }

  private async fetchLocalCocktails(name: string): Promise<any[]> {
    try {
      const MAX_LOCAL_FETCH = 100;
      const response = await this.localService.findAll({ limit: MAX_LOCAL_FETCH, page: 1 });
      const localCocktails = response.data;
      
      if (!name) {
        return localCocktails;
      }
      
      // Fuzzy search with multiple criteria
      return localCocktails.filter(c => 
        c.name.toLowerCase().includes(name.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(name.toLowerCase())) ||
        c.ingredients.some(ing => 
          ing.ingredient.name.toLowerCase().includes(name.toLowerCase())
        )
      );
    } catch (error) {
      this.logger.warn('Failed to fetch local cocktails:', error);
      return [];
    }
  }

  private async fetchExternalCocktails(name: string): Promise<any[]> {
    try {
      if (!name) {
        const randomCocktails: any[] = [];
        for (let i = 0; i < 3; i++) {
          try {
            const random = await this.externalService.getRandomCocktail();
            if (random) randomCocktails.push(random);
          } catch (error) {
            // Ignore individual random cocktail failures
          }
        }
        return randomCocktails;
      }
      
      return await this.externalService.searchByName(name);
    } catch (error) {
      this.logger.warn('Failed to fetch external cocktails:', error);
      return [];
    }
  }
}
