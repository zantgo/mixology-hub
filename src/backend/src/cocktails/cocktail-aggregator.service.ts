import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { Decimal } from 'decimal.js';
import { ZeroResultSearch } from './entities/zero-result-search.entity';
import { HiddenExternalCocktail } from './entities/hidden-external-cocktail.entity';
import { CocktailsService } from './cocktails.service';
import { CocktailDbService } from '../external/the-cocktail-db/cocktail-db.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { BarInventoryService } from '../inventory/bar-inventory.service';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';
import { MeasureParserService } from '../utils/measure-parser.service';
import { MakeabilityService } from '../inventory/makeability.service';

export interface CocktailDbDrink {
  idDrink: string;
  strDrink: string;
  strInstructions: string | null;
  strCategory: string | null;
  strAlcoholic: string;
  strGlass: string | null;
  strTags: string | null;
  strDrinkThumb: string | null;
  [key: `strIngredient${number}`]: string | null;
  [key: `strMeasure${number}`]: string | null;
}

export interface FormattedCocktail {
  id: string;
  externalId: string;
  name: string;
  description: string;
  instructions: string;
  isPublic: boolean;
  source: string;
  imageFull: string | null;
  imageThumb: string | null;
  category: string | null;
  alcoholic: boolean;
  glass: string | null;
  tags: string[];
  ingredients: FormattedCocktailIngredient[];
  makeabilityScore?: number;
  isMakeable?: boolean;
  metadata: {
    complexityScore: number;
    ingredientCount: number;
    estimatedVolumeMl: number;
    lastUpdated: string;
    source: string;
  };
}

export interface FormattedCocktailIngredient {
  measure: string;
  amount: number;
  unit: string;
  ingredient: {
    id: string;
    name: string;
    externalId?: string;
  };
}

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
  fuzzy?: boolean;
  includeIngredients?: string[];
  excludeIngredients?: string[];
  ingredientsAny?: string[];
  sortBy?: 'name' | 'popularity' | 'makeability' | 'complexity';
  sortOrder?: 'asc' | 'desc';
  filters?: SearchFilters;
}

export interface FetchSearchResult {
  data: FormattedCocktail[];
  meta: {
    currentPage: number;
    nextPage: number | null;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
  };
  metadata: {
    sources?: { local: number; external: number; total: number };
    filters?: SearchFilters;
    sort?: { by: string; order: string };
    error?: string;
  };
}

@Injectable()
export class CocktailAggregatorService {
  private readonly logger = new Logger(CocktailAggregatorService.name);

  constructor(
    private readonly localService: CocktailsService,
    private readonly cocktailDbService: CocktailDbService,
    private readonly inventoryService: BarInventoryService,
    private readonly hierarchicalService: HierarchicalIngredientService,
    private readonly measureParser: MeasureParserService,
    private readonly makeabilityService: MakeabilityService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRepository(ZeroResultSearch)
    private readonly zeroResultSearchRepository: Repository<ZeroResultSearch>,
    @InjectRepository(HiddenExternalCocktail)
    private readonly hiddenRepository: Repository<HiddenExternalCocktail>,
  ) {}

  /**
   * Fetch a single external cocktail by its TheCocktailDB ID, mapped to local format.
   * Used by FavoritesService to hydrate external favorites.
   */
  async getExternalCocktailById(
    externalId: string,
  ): Promise<FormattedCocktail | null> {
    try {
      const isHidden = await this.hiddenRepository.findOne({
        where: { externalId },
      });
      if (isHidden) return null;

      const drink = (await this.cocktailDbService.getCocktailById(
        externalId,
      )) as CocktailDbDrink | null;
      if (!drink) return null;
      return this.mapExternalToLocal(drink);
    } catch (err) {
      this.logger.warn(`Failed to fetch external cocktail ${externalId}:`, err);
      return null;
    }
  }

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
      const cacheKey = this.generateSearchCacheKey(
        sanitizedName,
        options,
        userId,
      );

      // Try to get cached results
      let cachedResults = await this.cacheManager.get<FormattedCocktail[]>(
        `search:${cacheKey}`,
      );

      if (!cachedResults || !Array.isArray(cachedResults)) {
        // Cache miss - fetch fresh data
        cachedResults = await this.fetchSearchResults(sanitizedName, options);
        // Cache results for 1 minute (reduced from 5 to prevent Redis memory bloat)
        await this.cacheManager.set(`search:${cacheKey}`, cachedResults, 60000);
      }

      // Apply pagination
      const paginatedList = cachedResults.slice(offset, offset + limit);
      const totalItems = cachedResults.length;
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;

      // Track zero-result searches synchronously in the database for product optimization (UC 14.4)
      if (totalItems === 0 && sanitizedName) {
        const zeroSearch = this.zeroResultSearchRepository.create({
          query: sanitizedName,
          filters: options.filters || {},
          userId: userId || null,
        });

        this.zeroResultSearchRepository.save(zeroSearch).catch((err) => {
          this.logger.error(
            'Failed to log zero-result search to database:',
            err,
          );
        });

        this.logger.log({
          event: 'zero_result_search',
          query: sanitizedName,
          filters: options.filters || {},
          userId: userId || 'anonymous',
        });
      }

      // 7. Add metadata
      // Count local vs external cocktails in the paginated results
      const localCount = paginatedList.filter(
        (item) => item.source === 'local',
      ).length;
      const externalCount = paginatedList.filter(
        (item) => item.source === 'api',
      ).length;

      const warnings: string[] = [];
      if (
        options.sortBy === 'makeability' &&
        options.includeExternal !== false
      ) {
        warnings.push(
          'External results excluded due to makeability sorting constraints',
        );
      }

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
        warnings,
      };

      return {
        data: paginatedList,
        meta: {
          currentPage: page,
          nextPage: hasNextPage ? page + 1 : null,
          itemsPerPage: limit,
          totalItems: totalItems,
          totalPages: totalPages,
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
          totalPages: 0,
        },
        metadata: {
          error: 'Search failed',
          sources: { local: 0, external: 0, total: 0 },
        },
      };
    }
  }

  private async applyFilters(
    cocktails: FormattedCocktail[],
    filters: SearchFilters,
  ): Promise<FormattedCocktail[]> {
    let expandedQuery: string[] | null = null;
    if (filters.ingredient) {
      const normalizedFilter = filters.ingredient.toLowerCase().trim();
      expandedQuery =
        await this.hierarchicalService.expandIngredientQuery(normalizedFilter);
    }

    const filtered: FormattedCocktail[] = [];

    for (const cocktail of cocktails) {
      let keep = true;

      if (expandedQuery) {
        const hasIngredient = cocktail.ingredients.some((ing) => {
          const ingName = (ing.ingredient?.name || '').toLowerCase().trim();
          return expandedQuery.some((eq) => ingName.includes(eq.toLowerCase()));
        });
        if (!hasIngredient) keep = false;
      }

      if (keep && filters.category) {
        const target = filters.category.toLowerCase().trim();
        const cocktailCategory = (cocktail.category || '').toLowerCase().trim();
        if (cocktailCategory !== target) keep = false;
      }

      if (keep && filters.glassType) {
        const target = filters.glassType.toLowerCase().trim();
        const cocktailGlass = (cocktail.glass || '').toLowerCase().trim();
        if (cocktailGlass !== target) keep = false;
      }

      if (keep && filters.alcoholic !== undefined) {
        if (cocktail.alcoholic !== filters.alcoholic) keep = false;
      }

      if (
        keep &&
        (filters.minIngredients !== undefined ||
          filters.maxIngredients !== undefined)
      ) {
        const ingredientCount = cocktail.ingredients.length;
        if (
          filters.minIngredients !== undefined &&
          ingredientCount < filters.minIngredients
        ) {
          keep = false;
        }
        if (
          filters.maxIngredients !== undefined &&
          ingredientCount > filters.maxIngredients
        ) {
          keep = false;
        }
      }

      if (keep) {
        filtered.push(cocktail);
      }
    }

    return filtered;
  }

  private async applyStrictInclusionFilter(
    cocktails: FormattedCocktail[],
    requiredIngredients: string[],
  ): Promise<FormattedCocktail[]> {
    const uniqueQueries = [...new Set(requiredIngredients)];
    const expandedMap = new Map<string, string[]>();
    await Promise.all(
      uniqueQueries.map(async (req) => {
        expandedMap.set(
          req,
          await this.hierarchicalService.expandIngredientQuery(req),
        );
      }),
    );

    const filtered: FormattedCocktail[] = [];

    for (const cocktail of cocktails) {
      let allSatisfied = true;

      for (const req of requiredIngredients) {
        let foundMatch = false;
        const expandedQuery = expandedMap.get(req)!;

        for (const ci of cocktail.ingredients) {
          const ciName = (ci.ingredient?.name || '').toLowerCase().trim();
          if (expandedQuery.some((eq) => ciName.includes(eq.toLowerCase()))) {
            foundMatch = true;
            break;
          }
        }

        if (!foundMatch) {
          allSatisfied = false;
          break;
        }
      }

      if (allSatisfied) {
        filtered.push(cocktail);
      }
    }

    return filtered;
  }

  private async calculateMakeabilityScores(
    cocktails: FormattedCocktail[],
  ): Promise<FormattedCocktail[]> {
    try {
      const inventory = await this.inventoryService.getInventory({
        limit: 9999,
        page: 1,
      });
      const inventoryData = inventory.data;

      return Promise.all(
        cocktails.map(async (cocktail) => {
          const makeabilityScore = await this.calculateMakeabilityScore(
            cocktail,
            inventoryData,
          );
          return {
            ...cocktail,
            makeabilityScore,
            isMakeable: makeabilityScore >= 0.8,
          };
        }),
      );
    } catch (error) {
      this.logger.warn('Failed to calculate makeability scores:', error);
      return cocktails.map((cocktail) => ({
        ...cocktail,
        makeabilityScore: 0,
        isMakeable: false,
      }));
    }
  }

  private async calculateMakeabilityScore(
    cocktail: FormattedCocktail,
    inventory: BarInventory[],
  ): Promise<number> {
    if (!cocktail.ingredients || cocktail.ingredients.length === 0) {
      return 0;
    }

    try {
      const scored = await this.makeabilityService.scoreCocktail(
        cocktail,
        inventory,
      );
      return scored.matchScore;
    } catch {
      return 0;
    }
  }

  private sortCocktails(
    cocktails: FormattedCocktail[],
    sortBy?: string,
    sortOrder?: string,
  ): FormattedCocktail[] {
    const order = sortOrder === 'desc' ? -1 : 1;

    return [...cocktails].sort((a, b) => {
      switch (sortBy) {
        case 'makeability': {
          const scoreA: number = a.makeabilityScore || 0;
          const scoreB: number = b.makeabilityScore || 0;
          return (scoreB - scoreA) * order;
        }

        case 'complexity': {
          const complexityA: number = a.ingredients?.length || 0;
          const complexityB: number = b.ingredients?.length || 0;
          return (complexityB - complexityA) * order;
        }

        case 'popularity': {
          const popularityA: number =
            (a as any).ratingCount || a.metadata?.ingredientCount || 0;
          const popularityB: number =
            (b as any).ratingCount || b.metadata?.ingredientCount || 0;
          return (popularityB - popularityA) * order;
        }

        case 'name':
        default: {
          const nameA: string = a.name?.toLowerCase() || '';
          const nameB: string = b.name?.toLowerCase() || '';
          return nameA.localeCompare(nameB) * order;
        }
      }
    });
  }

  /**
   * Enhanced mapper with validation and additional metadata.
   */
  private mapExternalToLocal(drink: CocktailDbDrink): FormattedCocktail | null {
    if (!drink || !drink.idDrink || !drink.strDrink) {
      return null;
    }

    const ingredients: FormattedCocktailIngredient[] = [];
    let totalVolumeMl = new Decimal(0);

    // TheCocktailDB uses strIngredient1 up to 15
    for (let i = 1; i <= 15; i++) {
      const ingredientKey = `strIngredient${i}` as const;
      const measureKey = `strMeasure${i}` as const;
      const ingredientName: string | null = drink[ingredientKey];
      const measure: string | null = drink[measureKey];

      if (ingredientName && ingredientName.trim() !== '') {
        const parsedMeasure = this.measureParser.parse(measure ?? '');

        ingredients.push({
          measure: measure ? measure.trim() : 'to taste',
          amount: parsedMeasure.amount,
          unit: parsedMeasure.unit,
          ingredient: {
            id: `ext-${drink.idDrink}-${i}`,
            name: ingredientName.trim().toLowerCase(),
            externalId: `thecocktaildb:${ingredientName.trim().toLowerCase()}`,
          },
        });

        // Estimate total volume (for complexity scoring)
        if (parsedMeasure.unit === 'ml' || parsedMeasure.unit === 'oz') {
          const ozToMl = new Decimal(29.57);
          const amount = new Decimal(parsedMeasure.amount);
          totalVolumeMl = totalVolumeMl.plus(
            parsedMeasure.unit === 'oz' ? amount.times(ozToMl) : amount,
          );
        }
      }
    }

    // Calculate complexity score
    const complexityScore = this.calculateComplexityScore(
      ingredients.length,
      totalVolumeMl.toNumber(),
    );

    // ADR 0016: Complete Image Blackout During External Search
    // Images are null for external results; only downloaded on "Save as Custom Cocktail"
    const imageFull: string | null = null;
    const imageThumb: string | null = null;

    return {
      id: `ext-${drink.idDrink}`,
      externalId: drink.idDrink,
      name: drink.strDrink,
      description: drink.strInstructions
        ? `Public recipe from TheCocktailDB: ${drink.strInstructions.length > 100 ? drink.strInstructions.substring(0, 100) + '...' : drink.strInstructions}`
        : 'Public recipe from TheCocktailDB',
      instructions: drink.strInstructions || 'No instructions provided',
      isPublic: true,
      source: 'api',
      imageFull: imageFull,
      imageThumb: imageThumb,
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
      },
    };
  }

  private calculateComplexityScore(
    ingredientCount: number,
    totalVolumeMl: number,
  ): number {
    let score = new Decimal(0);

    // Based on ingredient count
    if (ingredientCount <= 3) score = score.plus(1);
    else if (ingredientCount <= 5) score = score.plus(2);
    else if (ingredientCount <= 7) score = score.plus(3);
    else score = score.plus(4);

    // Based on total volume (proxy for preparation time)
    if (totalVolumeMl > 200) score = score.plus(1);
    if (totalVolumeMl > 300) score = score.plus(1);

    // Normalize to 0-5 scale
    return Decimal.min(5, score).toNumber();
  }

  private async applyExclusionFilter(
    cocktails: FormattedCocktail[],
    excludedIngredients: string[],
  ): Promise<FormattedCocktail[]> {
    const uniqueQueries = [...new Set(excludedIngredients)];
    const expandedMap = new Map<string, string[]>();
    await Promise.all(
      uniqueQueries.map(async (excl) => {
        expandedMap.set(
          excl,
          await this.hierarchicalService.expandIngredientQuery(excl),
        );
      }),
    );

    const filtered: FormattedCocktail[] = [];

    for (const cocktail of cocktails) {
      let containsExcluded = false;

      for (const excl of excludedIngredients) {
        const expandedQuery = expandedMap.get(excl)!;

        for (const ci of cocktail.ingredients) {
          const ciName = (ci.ingredient?.name || '').toLowerCase().trim();
          if (expandedQuery.some((eq) => ciName.includes(eq.toLowerCase()))) {
            containsExcluded = true;
            break;
          }
        }
        if (containsExcluded) break;
      }

      if (!containsExcluded) {
        filtered.push(cocktail);
      }
    }

    return filtered;
  }

  private async applyIngredientsAnyFilter(
    cocktails: FormattedCocktail[],
    anyIngredients: string[],
  ): Promise<FormattedCocktail[]> {
    const uniqueQueries = [...new Set(anyIngredients)];
    const expandedMap = new Map<string, string[]>();
    await Promise.all(
      uniqueQueries.map(async (req) => {
        expandedMap.set(
          req,
          await this.hierarchicalService.expandIngredientQuery(req),
        );
      }),
    );

    const filtered: FormattedCocktail[] = [];

    for (const cocktail of cocktails) {
      let foundAny = false;

      for (const req of anyIngredients) {
        const expandedQuery = expandedMap.get(req)!;

        for (const ci of cocktail.ingredients) {
          const ciName = (ci.ingredient?.name || '').toLowerCase().trim();
          if (expandedQuery.some((eq) => ciName.includes(eq.toLowerCase()))) {
            foundAny = true;
            break;
          }
        }
        if (foundAny) break;
      }

      if (foundAny) {
        filtered.push(cocktail);
      }
    }

    return filtered;
  }

  private generateSearchCacheKey(
    name: string,
    options: SearchOptions,
    userId?: string,
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

    return keyParts.filter((part) => part).join(':');
  }

  private async fetchSearchResults(
    name: string,
    options: SearchOptions,
  ): Promise<FormattedCocktail[]> {
    // 1. Fetch data from all sources in parallel
    const hasQuery = name && name.trim().length > 0;
    const includeExternal =
      options.includeExternal !== false &&
      hasQuery &&
      options.sortBy !== 'makeability';
    const [localCocktails, externalCocktails] = await Promise.all([
      options.includeLocal !== false
        ? this.fetchLocalCocktails(name, options)
        : Promise.resolve([] as FormattedCocktail[]),
      includeExternal
        ? this.fetchExternalCocktails(name)
        : Promise.resolve([] as CocktailDbDrink[]),
    ]);

    // 2. Normalize and combine
    const normalizedExternal: (FormattedCocktail | null)[] = Array.isArray(
      externalCocktails,
    )
      ? externalCocktails.map((drink: CocktailDbDrink) =>
          this.mapExternalToLocal(drink),
        )
      : [];
    const validExternal = normalizedExternal.filter(
      (item): item is FormattedCocktail => item !== null,
    );

    const hiddenRecords = await this.hiddenRepository.find({
      select: ['externalId'],
    });
    const hiddenIds = new Set(hiddenRecords.map((r) => r.externalId));

    const validExternalFiltered = validExternal.filter(
      (item) => !hiddenIds.has(item.externalId),
    );

    let unifiedList: FormattedCocktail[] = [
      ...localCocktails,
      ...validExternalFiltered,
    ];

    // 2b. Deduplicate: local cocktails take precedence over external ones with matching name (case-insensitive)
    const localNames = new Set(
      localCocktails.map((c) => c.name?.toLowerCase().trim()).filter(Boolean),
    );
    unifiedList = unifiedList.filter((item) => {
      if (
        item.source === 'api' &&
        localNames.has(item.name?.toLowerCase().trim())
      ) {
        return false;
      }
      return true;
    });

    // 3. Apply filters
    if (options.filters) {
      unifiedList = await this.applyFilters(unifiedList, options.filters);
    }

    // 3b. Apply strict inclusion filter (requires ALL specified ingredients)
    if (options.includeIngredients && options.includeIngredients.length > 0) {
      unifiedList = await this.applyStrictInclusionFilter(
        unifiedList,
        options.includeIngredients,
      );
    }

    // 3c. Apply exclusion filter (removes cocktails containing ANY excluded ingredient)
    if (options.excludeIngredients && options.excludeIngredients.length > 0) {
      unifiedList = await this.applyExclusionFilter(
        unifiedList,
        options.excludeIngredients,
      );
    }

    // 3d. Apply OR filter (keeps cocktails containing AT LEAST ONE ingredient)
    if (options.ingredientsAny && options.ingredientsAny.length > 0) {
      unifiedList = await this.applyIngredientsAnyFilter(
        unifiedList,
        options.ingredientsAny,
      );
    }

    // 4. Calculate makeability scores
    unifiedList = await this.calculateMakeabilityScores(unifiedList);

    // 5. Sort results
    unifiedList = this.sortCocktails(
      unifiedList,
      options.sortBy,
      options.sortOrder,
    );

    return unifiedList;
  }

  private async fetchLocalCocktails(
    name: string,
    options?: SearchOptions,
  ): Promise<FormattedCocktail[]> {
    const MAX_LOCAL_FETCH = 100;

    try {
      if (name) {
        const result = await this.localService.searchByName(
          name,
          { limit: MAX_LOCAL_FETCH, page: 1 },
          { fuzzy: options?.fuzzy ?? false },
        );
        return result.data as unknown as FormattedCocktail[];
      }

      const response = await this.localService.findAll({
        limit: MAX_LOCAL_FETCH,
        page: 1,
      });
      return response.data as unknown as FormattedCocktail[];
    } catch (error) {
      this.logger.warn('Failed to fetch local cocktails:', error);

      // Fallback to basic findAll if searchByName is not available
      if (name) {
        try {
          const response = await this.localService.findAll({
            limit: MAX_LOCAL_FETCH,
            page: 1,
          });
          return (response.data as unknown as FormattedCocktail[]).filter(
            (c) =>
              (c.name ?? '').toLowerCase().includes(name.toLowerCase()) ||
              (c.description &&
                c.description.toLowerCase().includes(name.toLowerCase())) ||
              c.ingredients.some((ing) =>
                ing.ingredient.name.toLowerCase().includes(name.toLowerCase()),
              ),
          );
        } catch (_fallbackError) {
          this.logger.warn('Fallback local fetch also failed:', _fallbackError);
          return [];
        }
      }
      return [];
    }
  }

  private async fetchExternalCocktails(
    name: string,
  ): Promise<CocktailDbDrink[]> {
    try {
      return (await this.cocktailDbService.searchByName(
        name,
      )) as CocktailDbDrink[];
    } catch (error) {
      this.logger.warn('Failed to fetch external cocktails:', error);
      return [];
    }
  }
}
