import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
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

  constructor(
    private readonly inventoryService: BarInventoryService,
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
      this.cocktailsService.findAll({ limit: 200, page: 1 }),
    ]);

    const inventoryItems = (inventoryResult as any).data || [];
    const allCocktails = (cocktailsResult as any).data || [];

    const scored = await Promise.all(
      allCocktails.map((c: any) => this.scoreCocktail(c, inventoryItems)),
    );

    scored.sort((a, b) => {
      const order = { makeable: 0, almost: 1, unmakeable: 2 };
      return order[a.makeability] - order[b.makeability];
    });

    const totalItems = scored.length;
    const offset = (page - 1) * limit;
    const paginated = scored.slice(offset, offset + limit);
    const totalPages = Math.ceil(totalItems / limit);

    const result = {
      data: paginated,
      meta: {
        currentPage: page,
        nextPage: page < totalPages ? page + 1 : null,
        itemsPerPage: limit,
        totalItems,
        totalPages,
      },
    };

    await this.cacheManager.set(cacheKey, result, 60000);
    return result;
  }

  private async scoreCocktail(
    cocktail: any,
    inventoryItems: any[],
  ): Promise<MakeableCocktail> {
    const ingredients = cocktail.ingredients || [];
    const missingIngredients: string[] = [];
    let matchedCount = 0;

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
        const requiredAmount = this.normalizeAmount(ci.amount, ci.unit, ci.ingredient.baseUnit, ci.ingredient);
        if (directMatch.quantity && directMatch.quantity.gte(requiredAmount)) {
          matchedCount++;
          found = true;
        }
      }

      if (!found) {
        try {
          const match = await this.hierarchicalService.findBestMatch(requiredName, {
            includeHierarchical: true,
            includeSynonyms: true,
            minConfidence: 0.7,
          });

          if (match && match.confidence >= 0.8) {
            const substituteInInventory = inventoryItems.find(
              (item: any) => item.ingredient?.id === match.ingredient.id,
            );

            if (substituteInInventory) {
              const requiredAmount = this.normalizeAmount(ci.amount, ci.unit, match.ingredient.baseUnit, match.ingredient);
              if (substituteInInventory.quantity?.gte(requiredAmount)) {
                matchedCount += match.confidence;
                found = true;
              }
            }
          }
        } catch (err) {
          this.logger.warn(`Hierarchical match failed for ${requiredName}: ${(err as Error).message}`);
        }
      }

      if (!found) {
        missingIngredients.push(ci.ingredient.name || 'Unknown');
      }
    }

    const total = ingredients.length || 1;
    const score = matchedCount / total;

    let makeability: MakeabilityVerdict;
    if (score >= 1.0) makeability = 'makeable';
    else if (score >= 0.5) makeability = 'almost';
    else makeability = 'unmakeable';

    return {
      id: cocktail.id,
      name: cocktail.name,
      description: cocktail.description,
      imageFull: cocktail.image_full,
      imageThumb: cocktail.image_thumb,
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
        return qty;
      }
    }
    return qty;
  }
}
