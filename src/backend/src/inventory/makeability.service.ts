import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Decimal } from 'decimal.js';
import { BarInventoryService } from './bar-inventory.service';
import { CocktailsService } from '../cocktails/cocktails.service';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';
import { UnitConverterService } from '../utils/unit-converter.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

export type MakeabilityVerdict = 'makeable' | 'almost' | 'unmakeable';

export interface MakeableCocktail {
  id: string;
  name: string;
  description?: string;
  imageFull?: string;
  imageThumb?: string;
  source: string;
  ingredients: any[];
  makeability: MakeabilityVerdict;
  missingIngredients: string[];
  matchScore: number;
}

@Injectable()
export class MakeabilityService {
  private readonly logger = new Logger(MakeabilityService.name);
  private readonly MAX_ITERATIONS = 200;

  constructor(
    private readonly inventoryService: BarInventoryService,
    @Inject(forwardRef(() => CocktailsService))
    private readonly cocktailsService: CocktailsService,
    private readonly hierarchicalService: HierarchicalIngredientService,
    private readonly unitConverter: UnitConverterService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getMakeableCocktails(paginationQuery: PaginationQueryDto) {
    const { limit = 10, page = 1 } = paginationQuery;

    const cacheKey = `makeability:${page}:${limit}`;
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    const [inventoryResult, cocktailsResult] = await Promise.all([
      this.inventoryService.getInventory({ limit: 9999, page: 1 }),
      this.cocktailsService.findAll({ limit: this.MAX_ITERATIONS, page: 1 }),
    ]);

    const inventoryItems = (inventoryResult as any).data || [];
    const allCocktails = (cocktailsResult as any).data || [];

    const offset = (page - 1) * limit;
    const makeableCocktails: any[] = [];
    let iterations = 0;

    for (const cocktail of allCocktails) {
      if (iterations >= this.MAX_ITERATIONS) break;

      iterations++;
      const scored = await this.scoreCocktail(cocktail, inventoryItems);

      if (
        scored.makeability === 'makeable' ||
        scored.makeability === 'almost'
      ) {
        makeableCocktails.push(scored);
      }

      if (makeableCocktails.length >= offset + limit) break;
    }

    makeableCocktails.sort((a, b) => {
      const order = { makeable: 0, almost: 1, unmakeable: 2 };
      return order[a.makeability] - order[b.makeability];
    });

    if (
      iterations >= this.MAX_ITERATIONS &&
      makeableCocktails.length > 0 &&
      makeableCocktails.length <= offset
    ) {
      throw new BadRequestException(
        'Pagination overshoot: Requested page exceeds available results due to computation limits.',
        'PAGINATION_OVERSHOOT',
      );
    }

    const paginated = makeableCocktails.slice(offset, offset + limit);
    const hasMore =
      iterations < this.MAX_ITERATIONS || allCocktails.length === 0
        ? makeableCocktails.length >= offset + limit
        : false;
    const totalItems = makeableCocktails.length;
    const totalPages = Math.ceil(totalItems / limit);

    const reachedLimit = iterations >= this.MAX_ITERATIONS;

    const result = {
      data: paginated,
      meta: {
        currentPage: page,
        nextPage: hasMore ? page + 1 : null,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        iterations,
        maxIterations: this.MAX_ITERATIONS,
        warning: reachedLimit
          ? 'Results limited by computation constraints. Try filtering to reduce candidates.'
          : null,
      },
    };

    await this.cacheManager.set(cacheKey, result, 60000);
    return result;
  }

  async scoreCocktail(
    cocktail: any,
    inventoryItems: any[],
  ): Promise<MakeableCocktail> {
    const ingredients = cocktail.ingredients || [];
    const missingIngredients: string[] = [];
    let matchedCount = new Decimal(0);

    const partSize = new Decimal(30);

    for (const ci of ingredients) {
      if (!ci.ingredient) {
        missingIngredients.push('Unknown ingredient');
        continue;
      }

      const requiredName = ci.ingredient.name?.toLowerCase().trim();
      const requiredId = ci.ingredient.id;
      let found = false;

      const directMatch = inventoryItems.find(
        (item: any) =>
          item.ingredient?.id === requiredId ||
          item.ingredient?.name?.toLowerCase().trim() === requiredName,
      );

      if (directMatch) {
        let requiredAmount: Decimal;
        if (ci.unit === 'part' || ci.unit === 'parts') {
          const calculatedMl = partSize.times(new Decimal(ci.amount || 0));
          requiredAmount = this.unitConverter.convert(
            calculatedMl,
            'ml',
            ci.ingredient.baseUnit,
            ci.ingredient,
          );
        } else {
          requiredAmount = this.normalizeAmount(
            ci.amount,
            ci.unit,
            ci.ingredient.baseUnit,
            ci.ingredient,
          );
        }
        if (directMatch.quantity && directMatch.quantity.gte(requiredAmount)) {
          matchedCount = matchedCount.plus(1);
          found = true;
        }
      }

      if (!found) {
        try {
          const match = await this.hierarchicalService.findBestMatch(
            requiredName,
            {
              includeHierarchical: true,
              includeSynonyms: true,
              minConfidence: 0.7,
            },
          );

          if (match && match.confidence >= 0.8) {
            const substituteInInventory = inventoryItems.find(
              (item: any) => item.ingredient?.id === match.ingredient.id,
            );

            if (substituteInInventory) {
              let requiredAmount: Decimal;
              if (ci.unit === 'part' || ci.unit === 'parts') {
                const calculatedMl = partSize.times(
                  new Decimal(ci.amount || 0),
                );
                requiredAmount = this.unitConverter.convert(
                  calculatedMl,
                  'ml',
                  match.ingredient.baseUnit,
                  match.ingredient,
                );
              } else {
                requiredAmount = this.normalizeAmount(
                  ci.amount,
                  ci.unit,
                  match.ingredient.baseUnit,
                  match.ingredient,
                );
              }
              if (substituteInInventory.quantity?.gte(requiredAmount)) {
                matchedCount = matchedCount.plus(match.confidence);
                found = true;
              }
            }
          }
        } catch (err) {
          this.logger.warn(
            `Hierarchical match failed for ${requiredName}: ${(err as Error).message}`,
          );
        }
      }

      if (!found) {
        missingIngredients.push(ci.ingredient.name || 'Unknown');
      }
    }

    const total = ingredients.length || 1;
    const score = matchedCount.div(total).toNumber();

    let makeability: MakeabilityVerdict;
    if (score >= 1.0) makeability = 'makeable';
    else if (score >= 0.5) makeability = 'almost';
    else makeability = 'unmakeable';

    return {
      id: cocktail.id,
      name: cocktail.name,
      description: cocktail.description,
      imageFull: cocktail.imageFull,
      imageThumb: cocktail.imageThumb,
      source: cocktail.source || 'local',
      ingredients: cocktail.ingredients,
      makeability,
      missingIngredients,
      matchScore: Math.round(score * 100) / 100,
    };
  }

  private normalizeAmount(
    amount: number | string,
    unit: string,
    baseUnit: string,
    ingredient: any,
  ): Decimal {
    const qty = new Decimal(amount || 0);
    if (unit && baseUnit && unit.toLowerCase() !== baseUnit.toLowerCase()) {
      try {
        return this.unitConverter.convert(qty, unit, baseUnit, ingredient);
      } catch {
        return new Decimal(Infinity);
      }
    }
    return qty;
  }
}
