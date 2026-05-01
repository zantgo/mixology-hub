import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Decimal } from 'decimal.js';
import { UserInventory } from './entities/user-inventory.entity';
import { AddInventoryDto } from './dto/add-inventory.dto';
import { UsersService } from './users.service';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { UnitConverterService } from '../utils/unit-converter.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CheckMakeabilityDto } from './dto/check-makeability.dto';
import { DepleteInventoryDto } from './dto/deplete-inventory.dto';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';

export interface MakeabilityResult {
  isMakeable: boolean;
  missingIngredients: Array<{
    ingredientId: string;
    ingredientName: string;
    requiredAmount: number;
    requiredUnit: string;
    availableAmount: number;
    availableUnit: string;
    missingAmount: number;
  }>;
  substitutions: Array<{
    requiredIngredientId: string;
    requiredIngredientName: string;
    substitutedWithId: string;
    substitutedWithName: string;
  }>;
}

@Injectable()
export class UserInventoryService {
  private readonly MAX_ITERATIONS = 200;

  constructor(
    @InjectRepository(UserInventory)
    private readonly inventoryRepository: Repository<UserInventory>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(Cocktail)
    private readonly cocktailRepository: Repository<Cocktail>,
    private readonly usersService: UsersService,
    private readonly unitConverter: UnitConverterService,
    private readonly hierarchicalIngredientService: HierarchicalIngredientService,
    private readonly dataSource: DataSource,
  ) {}

  async addToInventory(userId: string, dto: AddInventoryDto) {
    const ingredient = await this.ingredientRepository.findOne({ where: { id: dto.ingredientId } });
    if (!ingredient) throw new NotFoundException('Ingredient not found');

    let quantityToStore: Decimal | number = dto.quantity;
    if (dto.unit !== ingredient.baseUnit) {
      try {
        quantityToStore = this.unitConverter.convert(dto.quantity, dto.unit, ingredient.baseUnit, ingredient);
      } catch (error) {
        throw new BadRequestException(`Cannot convert ${dto.quantity} ${dto.unit} to ${ingredient.baseUnit}: ${error.message}`);
      }
    }

    let inventoryItem = await this.inventoryRepository.findOne({
      where: { user: { id: userId }, ingredient: { id: ingredient.id } },
      relations: ['ingredient'],
    });

    if (inventoryItem) {
      const currentQty = inventoryItem.quantity instanceof Decimal
        ? inventoryItem.quantity
        : new Decimal(inventoryItem.quantity || 0);
      const addQty = quantityToStore instanceof Decimal
        ? quantityToStore
        : new Decimal(quantityToStore);
      inventoryItem.quantity = currentQty.plus(addQty);
      inventoryItem.unit = ingredient.baseUnit;
    } else {
      inventoryItem = this.inventoryRepository.create({
        user: { id: userId },
        ingredient,
        quantity: quantityToStore,
        unit: ingredient.baseUnit,
      });
    }

    return await this.inventoryRepository.save(inventoryItem);
  }

  async getInventory(userId: string): Promise<UserInventory[]> {
    return await this.inventoryRepository.find({
      where: { user: { id: userId } },
      relations: ['ingredient', 'ingredient.parent'],
      order: { ingredient: { name: 'ASC' } },
    });
  }

  async removeFromInventory(userId: string, inventoryItemId: string) {
    const item = await this.inventoryRepository.findOne({
      where: { id: inventoryItemId, user: { id: userId } },
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    return await this.inventoryRepository.remove(item);
  }

  async updateInventoryItem(userId: string, inventoryItemId: string, quantity: number, unit: string) {
    const item = await this.inventoryRepository.findOne({
      where: { id: inventoryItemId, user: { id: userId } },
      relations: ['ingredient'],
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    let quantityToStore: Decimal | number = quantity;
    if (unit !== item.ingredient.baseUnit) {
      try {
        quantityToStore = this.unitConverter.convert(quantity, unit, item.ingredient.baseUnit, item.ingredient);
      } catch (error) {
        throw new BadRequestException(`Cannot convert ${quantity} ${unit} to ${item.ingredient.baseUnit}: ${error.message}`);
      }
    }

    item.quantity = quantityToStore instanceof Decimal ? quantityToStore : new Decimal(quantityToStore);
    item.unit = item.ingredient.baseUnit;

    return await this.inventoryRepository.save(item);
  }

  async checkMakeability(userId: string, dto: CheckMakeabilityDto): Promise<MakeabilityResult> {
    const inventory = await this.getInventory(userId);
    const missingIngredients: MakeabilityResult['missingIngredients'] = [];
    const substitutions: MakeabilityResult['substitutions'] = [];

    for (const required of dto.ingredients) {
      const requiredIngredient = await this.ingredientRepository.findOne({
        where: { id: required.ingredientId },
        relations: ['parent'],
      });
      if (!requiredIngredient) {
        throw new NotFoundException(`Ingredient ${required.ingredientId} not found`);
      }

      const matchingInventory = await this.findMatchingInventoryItem(
        inventory,
        requiredIngredient,
        required.amount,
        required.unit
      );

      if (!matchingInventory) {
        missingIngredients.push({
          ingredientId: required.ingredientId,
          ingredientName: requiredIngredient.name,
          requiredAmount: required.amount,
          requiredUnit: required.unit,
          availableAmount: 0,
          availableUnit: required.unit,
          missingAmount: required.amount,
        });
      } else if (matchingInventory.isSubstitution) {
        substitutions.push({
          requiredIngredientId: required.ingredientId,
          requiredIngredientName: requiredIngredient.name,
          substitutedWithId: matchingInventory.item.ingredient.id,
          substitutedWithName: matchingInventory.item.ingredient.name,
        });
      }
    }

    return {
      isMakeable: missingIngredients.length === 0,
      missingIngredients,
      substitutions,
    };
  }

  private async findMatchingInventoryItem(
    inventory: UserInventory[],
    requiredIngredient: Ingredient,
    requiredAmount: number,
    requiredUnit: string
  ): Promise<{ item: UserInventory; isSubstitution: boolean } | null> {
    // 1. Direct match
    const directMatch = inventory.find(item =>
      item.ingredient.id === requiredIngredient.id
    );
    if (directMatch) {
      const hasEnough = this.unitConverter.hasEnoughStock(
        directMatch.quantity,
        directMatch.unit,
        requiredAmount,
        requiredUnit,
        requiredIngredient
      );
      if (hasEnough) {
        return { item: directMatch, isSubstitution: false };
      }
    }

    // 2. Use hierarchical ingredient service to find substitutions
    const substitutions = await this.hierarchicalIngredientService.findSubstitutions(
      requiredIngredient.id,
      { maxSubstitutions: 10, minConfidence: 0.7 }
    );

    // 3. Check inventory for substitution matches
    for (const substitution of substitutions) {
      const substitutionMatch = inventory.find(item =>
        item.ingredient.id === substitution.substitute.id
      );

      if (substitutionMatch) {
        const hasEnough = this.unitConverter.hasEnoughStock(
          substitutionMatch.quantity,
          substitutionMatch.unit,
          requiredAmount,
          requiredUnit,
          requiredIngredient
        );
        if (hasEnough) {
          return {
            item: substitutionMatch,
            isSubstitution: true
          };
        }
      }
    }

    return null;
  }

  async depleteInventory(userId: string, dto: DepleteInventoryDto): Promise<{ success: boolean; depletedItems: Array<{ ingredientId: string; amountDepleted: number }> }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const depletedItems: Array<{ ingredientId: string; amountDepleted: number }> = [];

      for (const required of dto.ingredients) {
        const requiredIngredient = await this.ingredientRepository.findOne({
          where: { id: required.ingredientId },
        });

        if (!requiredIngredient) {
          throw new NotFoundException(`Ingredient ${required.ingredientId} not found`);
        }

        const amountToDeplete = this.unitConverter.convert(
          required.amount,
          required.unit,
          requiredIngredient.baseUnit,
          requiredIngredient
        );

        const result = await queryRunner.manager
          .createQueryBuilder()
          .update(UserInventory)
          .set({
            quantity: () => `quantity - :amount`,
          })
          .where('user_id = :userId', { userId })
          .andWhere('ingredient_id = :ingredientId', { ingredientId: required.ingredientId })
          .andWhere('quantity >= :amount', { amount: amountToDeplete.toString() })
          .returning('*')
          .execute();

        if (!result.affected || result.affected === 0) {
          throw new BadRequestException(
            `Not enough stock for ingredient: ${requiredIngredient.name || required.ingredientId}`
          );
        }

        const depletedAmount = amountToDeplete instanceof Decimal
          ? amountToDeplete.toNumber()
          : amountToDeplete;

        depletedItems.push({
          ingredientId: required.ingredientId,
          amountDepleted: depletedAmount,
        });
      }

      // Clean up rows that reached zero
      await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(UserInventory)
        .where('user_id = :userId', { userId })
        .andWhere('quantity <= 0')
        .execute();

      await queryRunner.commitTransaction();
      return { success: true, depletedItems };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getMakeableCocktails(userId: string, paginationQuery: PaginationQueryDto) {
    const inventory = await this.getInventory(userId);

    if (inventory.length === 0) {
      const { limit = 10, page = 1 } = paginationQuery;
      return {
        data: [],
        meta: {
          currentPage: page,
          nextPage: null,
          itemsPerPage: limit,
          totalItems: 0,
          totalPages: 0
        }
      };
    }

    const allCocktails = await this.cocktailRepository.find({
      relations: ['ingredients', 'ingredients.ingredient'],
      where: { is_public: true },
    });

    const { limit = 10, page = 1 } = paginationQuery;
    const offset = (page - 1) * limit;
    const targetCount = offset + limit;

    const makeableCocktails: Cocktail[] = [];
    let iterations = 0;

    // Iterate through cocktails with a hard cap per ADR 0008
    for (const cocktail of allCocktails) {
      if (iterations >= this.MAX_ITERATIONS) {
        break;
      }
      iterations++;

      let isMakeable = true;
      for (const cocktailIngredient of cocktail.ingredients) {
        const matchingInventory = await this.findMatchingInventoryItem(
          inventory,
          cocktailIngredient.ingredient,
          cocktailIngredient.amount instanceof Decimal
            ? cocktailIngredient.amount.toNumber()
            : cocktailIngredient.amount,
          cocktailIngredient.unit
        );

        if (!matchingInventory) {
          isMakeable = false;
          break;
        }
      }

      if (isMakeable) {
        makeableCocktails.push(cocktail);
        if (makeableCocktails.length >= targetCount) {
          break;
        }
      }
    }

    // Check for pagination overshoot per ADR 0008
    if (iterations >= this.MAX_ITERATIONS && makeableCocktails.length > 0 && makeableCocktails.length <= offset) {
      throw new BadRequestException(
        'Pagination overshoot: Requested page exceeds available results due to computation limits.',
        'PAGINATION_OVERSHOOT'
      );
    }

    const paginatedData = makeableCocktails.slice(offset, offset + limit);
    const totalItems = makeableCocktails.length;
    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;

    return {
      data: paginatedData,
      meta: {
        currentPage: page,
        nextPage: hasNextPage ? page + 1 : null,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        iterations,
        maxIterations: this.MAX_ITERATIONS,
        warning: iterations >= this.MAX_ITERATIONS
          ? 'Results limited by computation constraints. Try filtering to reduce candidates.'
          : null,
      }
    };
  }

  async getInventorySummary(userId: string) {
    const inventory = await this.getInventory(userId);

    const totalItems = inventory.length;
    const totalVolume = inventory.reduce((sum, item) => {
      if (item.ingredient.baseUnit === 'count') {
        const qty = item.quantity instanceof Decimal
          ? item.quantity.toNumber()
          : Number(item.quantity);
        return new Decimal(sum).plus(qty);
      }
      try {
        const volumeInMl = this.unitConverter.convert(item.quantity, item.unit, 'ml', item.ingredient);
        return sum.plus(volumeInMl);
      } catch {
        return sum;
      }
    }, new Decimal(0));

    const categories = new Set<string>();
    inventory.forEach(item => {
      const name = item.ingredient.name.toLowerCase();
      if (name.includes('vodka') || name.includes('gin') || name.includes('rum') ||
          name.includes('tequila') || name.includes('whiskey') || name.includes('bourbon')) {
        categories.add('Spirits');
      } else if (name.includes('juice') || name.includes('soda') || name.includes('tonic')) {
        categories.add('Mixers');
      } else if (name.includes('bitters') || name.includes('syrup') || name.includes('vermouth')) {
        categories.add('Modifiers');
      } else if (name.includes('fruit') || name.includes('herb') || name.includes('spice')) {
        categories.add('Garnishes');
      } else {
        categories.add('Other');
      }
    });

    return {
      totalItems,
      totalVolumeMl: Math.round(totalVolume.toNumber()),
      categories: Array.from(categories),
      lowStockItems: inventory.filter(item => {
        if (item.ingredient.baseUnit === 'count') {
          const qty = item.quantity instanceof Decimal
            ? item.quantity
            : new Decimal(item.quantity || 0);
          return qty.lt(5);
        }
        try {
          const volumeInMl = this.unitConverter.convert(item.quantity, item.unit, 'ml', item.ingredient);
          return volumeInMl.lt(100);
        } catch {
          return false;
        }
      }).map(item => ({
        id: item.id,
        ingredientName: item.ingredient.name,
        quantity: item.quantity instanceof Decimal ? item.quantity.toNumber() : Number(item.quantity),
        unit: item.unit,
      })),
    };
  }
}
