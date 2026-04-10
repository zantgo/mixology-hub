import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CocktailsService } from './cocktails.service';
import { EnhancedTheCocktailDbService } from '../external/the-cocktail-db/enhanced-cocktail-db.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UserInventoryService } from '../users/user-inventory.service';
import { ImageService } from '../images/image.service';
import axios from 'axios';

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
    private readonly imageService: ImageService,
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
      const { limit = 10, offset = 0 } = paginationQuery;

      // Validate and sanitize inputs
      if (name && name.trim().length > 100) {
        throw new BadRequestException('Search query too long');
      }

      const sanitizedName = name ? name.trim() : '';

      // Generate cache key for this search
      const cacheKey = this.generateSearchCacheKey(sanitizedName, options, userId);
      
      // Try to get pagination state from cache
      let paginationState = await this.cacheManager.get<any>(`pagination:${cacheKey}`);
      
      if (!paginationState || offset === 0) {
        // Cache miss or first page - fetch fresh data
        paginationState = await this.fetchAndCacheSearchResults(
          sanitizedName, options, userId, cacheKey
        );
      }

      // Apply pagination using cached state
      const { unifiedList, lastId } = paginationState;
      
      // Use optimized pagination: if we have lastId, use cursor-based pagination
      let paginatedList;
      if (lastId && offset > 0) {
        // Find position of lastId and slice from there
        const lastIndex = unifiedList.findIndex(item => item.id === lastId);
        if (lastIndex !== -1) {
          paginatedList = unifiedList.slice(lastIndex + 1, lastIndex + 1 + limit);
        } else {
          // Fallback to offset pagination
          paginatedList = unifiedList.slice(offset, offset + limit);
        }
      } else {
        // First page or no lastId - use offset pagination
        paginatedList = unifiedList.slice(offset, offset + limit);
      }

      // Update lastId in cache for next page
      if (paginatedList.length > 0) {
        const newLastId = paginatedList[paginatedList.length - 1].id;
        await this.cacheManager.set(`pagination:${cacheKey}`, {
          ...paginationState,
          lastId: newLastId,
        }, 300); // 5 minute TTL
      }

      // 7. Add metadata
      // Count local vs external cocktails in the paginated results
      const localCount = paginatedList.filter(item => item.source === 'local').length;
      const externalCount = paginatedList.filter(item => item.source === 'api').length;
      
      const metadata = {
        sources: {
          local: localCount,
          external: externalCount,
          total: paginationState.unifiedList.length,
        },
        filters: options.filters || {},
        sort: {
          by: options.sortBy || 'name',
          order: options.sortOrder || 'asc',
        },
      };

      return {
        data: paginatedList,
        total: unifiedList.length,
        limit,
        offset,
        metadata,
      };

    } catch (err) {
      this.logger.error('Enhanced search unified failed:', err);
      
      // Graceful degradation: return empty results with error info
      return { 
        data: [], 
        total: 0, 
        limit: paginationQuery.limit || 10, 
        offset: paginationQuery.offset || 0,
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
        const hasIngredient = cocktail.ingredients.some((ing: any) =>
          ing.ingredient.name.toLowerCase().includes(filters.ingredient!.toLowerCase())
        );
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
      
      // Check for direct match
      const directMatch = inventory.find(item => 
        item.ingredient.id === requiredIngredient.id ||
        item.ingredient.name.toLowerCase() === requiredIngredient.name.toLowerCase()
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
    let totalVolumeMl = 0;
    
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
          totalVolumeMl += parsedMeasure.unit === 'oz' ? parsedMeasure.amount * 29.57 : parsedMeasure.amount;
        }
      }
    }

    // Calculate complexity score
    const complexityScore = this.calculateComplexityScore(ingredients.length, totalVolumeMl);

    // Download and process external image
    let imageFull: string | null = null;
    let imageThumb: string | null = null;
    const externalImageUrl = this.validateImageUrl(drink.strDrinkThumb);
    
    if (externalImageUrl) {
      try {
        // Download the image
        const response = await axios.get(externalImageUrl, { 
          responseType: 'arraybuffer',
          timeout: 5000 // 5 second timeout
        });
        
        // Process with ImageService
        const imagePaths = await this.imageService.processAndSaveBuffer(response.data);
        imageFull = imagePaths.full;
        imageThumb = imagePaths.thumb;
      } catch (error) {
        this.logger.warn(`Failed to download external image for ${drink.strDrink}:`, error);
        // Continue without image - will use default fallback
      }
    }

    return {
      id: `ext-${drink.idDrink}`,
      externalId: drink.idDrink,
      name: drink.strDrink,
      description: drink.strInstructions ? `Public recipe from TheCocktailDB: ${drink.strInstructions.substring(0, 100)}...` : 'Public recipe from TheCocktailDB',
      instructions: drink.strInstructions || 'No instructions provided',
      is_public: true,
      source: 'api',
      image_url: externalImageUrl, // Keep for backward compatibility
      image_full: imageFull, // New local image path
      image_thumb: imageThumb, // New local thumbnail path
      category: drink.strCategory || null,
      alcoholic: drink.strAlcoholic === 'Alcoholic',
      glass: drink.strGlass || null,
      tags: drink.strTags ? drink.strTags.split(',') : [],
      ingredients: ingredients,
      metadata: {
        complexityScore,
        ingredientCount: ingredients.length,
        estimatedVolumeMl: Math.round(totalVolumeMl),
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
    
    // Common patterns
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
        return { amount: parseFloat(match[1]), unit: pattern.unit };
      }
    }

    // Default to parts if it's just a number
    const numberMatch = measureStr.match(/(\d+(?:\.\d+)?)/);
    if (numberMatch) {
      return { amount: parseFloat(numberMatch[1]), unit: 'parts' };
    }

    // Default values for descriptive measures
    if (measureStr.includes('pinch') || measureStr.includes('dash')) {
      return { amount: 1, unit: 'dashes' };
    }
    if (measureStr.includes('splash')) {
      return { amount: 1, unit: 'splashes' };
    }
    if (measureStr.includes('to taste') || measureStr.includes('garnish')) {
      return { amount: 1, unit: 'units' };
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

  private validateImageUrl(url: string): string | null {
    if (!url) return null;
    
    // Basic URL validation
    try {
      const parsedUrl = new URL(url);
      
      // Only allow HTTPS
      if (parsedUrl.protocol !== 'https:') {
        this.logger.warn(`Invalid image URL protocol: ${url}`);
        return null;
      }
      
      // Check for common image extensions
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const hasImageExtension = imageExtensions.some(ext => 
        parsedUrl.pathname.toLowerCase().endsWith(ext)
      );
      
      if (!hasImageExtension) {
        this.logger.warn(`Image URL missing valid extension: ${url}`);
        return null;
      }
      
      return url;
    } catch (error) {
      this.logger.warn(`Invalid image URL: ${url}`, error);
      return null;
    }
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

  private async fetchAndCacheSearchResults(
    name: string,
    options: SearchOptions,
    userId?: string,
    cacheKey?: string
  ): Promise<{ unifiedList: any[]; lastId?: string }> {
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

    // Cache the full results
    if (cacheKey) {
      await this.cacheManager.set(
        `pagination:${cacheKey}`,
        { unifiedList, lastId: undefined },
        300 // 5 minute TTL
      );
    }

    return { unifiedList };
  }

  private async fetchLocalCocktails(name: string): Promise<any[]> {
    try {
      // Use a high limit internally to allow filtering
      const response = await this.localService.findAll({ limit: 10000, offset: 0 });
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
        // For empty search, get random cocktails
        const randomCocktails: any[] = [];
        for (let i = 0; i < 5; i++) {
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
