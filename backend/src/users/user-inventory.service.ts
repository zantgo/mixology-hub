import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource, QueryRunner } from 'typeorm';
import { UserInventory } from './entities/user-inventory.entity';
import { AddInventoryDto } from './dto/add-inventory.dto';
import { UsersService } from './users.service';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { UnitConverterService } from '../utils/unit-converter.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CheckMakeabilityDto } from './dto/check-makeability.dto';
import { DepleteInventoryDto } from './dto/deplete-inventory.dto';
// BulkSyncDto removed as part of Online-Only Mandate
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

    // Convert to base unit for storage
    let quantityToStore = dto.quantity;
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
      // Update existing item
      inventoryItem.quantity = Number(inventoryItem.quantity) + quantityToStore;
      inventoryItem.unit = ingredient.baseUnit;
    } else {
      // Create new item
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

    // Convert to ingredient's base unit
    let quantityToStore = quantity;
    if (unit !== item.ingredient.baseUnit) {
      try {
        quantityToStore = this.unitConverter.convert(quantity, unit, item.ingredient.baseUnit, item.ingredient);
      } catch (error) {
        throw new BadRequestException(`Cannot convert ${quantity} ${unit} to ${item.ingredient.baseUnit}: ${error.message}`);
      }
    }

    item.quantity = quantityToStore;
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

      // Find matching inventory item considering hierarchy and synonyms
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
      const makeabilityResult = await this.checkMakeability(userId, {
        ingredients: dto.ingredients,
      });

      if (!makeabilityResult.isMakeable) {
        throw new BadRequestException('Cannot deplete inventory: missing ingredients', {
          cause: makeabilityResult.missingIngredients,
        });
      }

      const depletedItems: Array<{ ingredientId: string; amountDepleted: number }> = [];

      for (const required of dto.ingredients) {
        const inventory = await this.getInventory(userId);
        const requiredIngredient = await this.ingredientRepository.findOne({
          where: { id: required.ingredientId },
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
          throw new InternalServerErrorException('Inventory item not found despite makeability check');
        }

        // Convert required amount to inventory item's unit
        const amountToDeplete = this.unitConverter.convert(
          required.amount,
          required.unit,
          matchingInventory.item.unit,
          requiredIngredient
        );

        // Update inventory
        matchingInventory.item.quantity = Number(matchingInventory.item.quantity) - amountToDeplete;

        // Handle count-based items (cannot have fractional quantities)
        if (matchingInventory.item.ingredient.baseUnit === 'units') {
          matchingInventory.item.quantity = Math.floor(matchingInventory.item.quantity);
        }

        // Remove item if quantity is zero or negative
        if (matchingInventory.item.quantity <= 0) {
          await queryRunner.manager.remove(UserInventory, matchingInventory.item);
        } else {
          await queryRunner.manager.save(UserInventory, matchingInventory.item);
        }

        depletedItems.push({
          ingredientId: matchingInventory.item.ingredient.id,
          amountDepleted: amountToDeplete,
        });
      }

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

    // Get all cocktails and filter by makeability
    // NOTE: This has an N+1 problem. For production, consider:
    // 1. Creating a PostgreSQL function for unit conversions
    // 2. Using a materialized view
    // 3. Implementing pagination at database level with window functions
    const allCocktails = await this.cocktailRepository.find({
      relations: ['ingredients', 'ingredients.ingredient'],
      where: { is_public: true },
    });

    const makeableCocktails = allCocktails.filter(cocktail => {
      for (const cocktailIngredient of cocktail.ingredients) {
        const requiredIngredient = cocktailIngredient.ingredient;
        const requiredAmount = cocktailIngredient.amount;
        const requiredUnit = cocktailIngredient.unit;

        const matchingInventory = this.findMatchingInventoryItem(
          inventory,
          requiredIngredient,
          requiredAmount,
          requiredUnit
        );

        if (!matchingInventory) {
          return false;
        }
      }
      return true;
    });

    // Apply pagination
    const { limit = 10, page = 1 } = paginationQuery;
    const offset = (page - 1) * limit;
    const paginatedData = makeableCocktails.slice(offset, offset + limit);
    
    const totalPages = Math.ceil(makeableCocktails.length / limit);
    const hasNextPage = page < totalPages;

    return {
      data: paginatedData,
      meta: {
        currentPage: page,
        nextPage: hasNextPage ? page + 1 : null,
        itemsPerPage: limit,
        totalItems: makeableCocktails.length,
        totalPages
      }
    };
  }

  async getInventorySummary(userId: string) {
    const inventory = await this.getInventory(userId);
    
    const totalItems = inventory.length;
    const totalVolume = inventory.reduce((sum, item) => {
      if (item.ingredient.baseUnit === 'units') {
        return sum + item.quantity; // Count-based items
      }
      // Convert all to ml for volume summary
      try {
        const volumeInMl = this.unitConverter.convert(item.quantity, item.unit, 'ml', item.ingredient);
        return sum + volumeInMl;
      } catch {
        return sum; // Skip unconvertible items
      }
    }, 0);

    const categories = new Set<string>();
    inventory.forEach(item => {
      // Simple category detection based on ingredient name
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
      totalVolumeMl: Math.round(totalVolume),
      categories: Array.from(categories),
      lowStockItems: inventory.filter(item => {
        // Consider items with less than 100ml or 5 units as low stock
        if (item.ingredient.baseUnit === 'units') {
          return item.quantity < 5;
        }
        try {
          const volumeInMl = this.unitConverter.convert(item.quantity, item.unit, 'ml', item.ingredient);
          return volumeInMl < 100;
        } catch {
          return false;
        }
      }).map(item => ({
        id: item.id,
        ingredientName: item.ingredient.name,
        quantity: item.quantity,
        unit: item.unit,
      })),
    };
  }

  // bulkSync method removed as part of Online-Only Mandate
}
