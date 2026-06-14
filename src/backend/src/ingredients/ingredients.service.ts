import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Decimal } from 'decimal.js';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';
import { HierarchicalIngredientService } from './hierarchical-ingredient.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(CocktailIngredient)
    private readonly cocktailIngredientRepository: Repository<CocktailIngredient>,
    @InjectRepository(BarInventory)
    private readonly barInventoryRepository: Repository<BarInventory>,
    private readonly hierarchicalService: HierarchicalIngredientService,
  ) {}

  async create(createIngredientDto: CreateIngredientDto, createdBy?: string) {
    try {
      const ingredient = this.ingredientRepository.create({
        name: createIngredientDto.name.toLowerCase().trim(),
        baseUnit: createIngredientDto.baseUnit || 'ml',
        createdBy: createdBy || null,
        isGlobal: !createdBy,
        parentId: createIngredientDto.parentId || null,
        ...(createIngredientDto.density !== undefined && {
          density: new Decimal(createIngredientDto.density),
        }),
      });
      return await this.ingredientRepository.save(ingredient);
    } catch (error: any) {
      // 23505 is the Postgres error code for Unique Violation
      if (error?.code === '23505')
        throw new ConflictException('Ingredient already exists');
      throw error;
    }
  }

  async findAll(paginationQuery: PaginationQueryDto, name?: string) {
    const { limit = 10, page = 1 } = paginationQuery;
    const offset = (page - 1) * limit;

    const queryBuilder =
      this.ingredientRepository.createQueryBuilder('ingredient');

    if (name && name.trim().length > 0) {
      const normalized = name.trim().toUpperCase();
      queryBuilder.where(
        'ingredient.normalizedName LIKE :name OR ingredient.name ILIKE :rawName',
        {
          name: `%${normalized}%`,
          rawName: `%${name.trim()}%`,
        },
      );
    }

    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;

    return {
      data,
      meta: {
        currentPage: page,
        nextPage: hasNextPage ? page + 1 : null,
        itemsPerPage: limit,
        totalItems: total,
        totalPages,
      },
    };
  }

  async findOne(id: string) {
    const ingredient = await this.ingredientRepository.findOne({
      where: { id },
    });
    if (!ingredient)
      throw new NotFoundException(`Ingredient with ID ${id} not found`);
    return ingredient;
  }

  async update(id: string, updateIngredientDto: UpdateIngredientDto) {
    const ingredient = await this.findOne(id);
    const newParentId = updateIngredientDto.parentId;
    if (
      newParentId !== undefined &&
      newParentId !== null &&
      newParentId !== ingredient.parentId
    ) {
      await this.hierarchicalService.detectCycle(id, newParentId);
    }

    if (
      updateIngredientDto.baseUnit &&
      updateIngredientDto.baseUnit !== ingredient.baseUnit
    ) {
      const recipeCount = await this.cocktailIngredientRepository.count({
        where: { ingredient: { id } },
      });
      const inventoryCount = await this.barInventoryRepository.count({
        where: { ingredient: { id } },
      });

      if (recipeCount > 0 || inventoryCount > 0) {
        throw new ConflictException(
          `Conflict: Cannot change baseUnit because ingredient is currently used in ${recipeCount} recipes and ${inventoryCount} inventory entries.`,
        );
      }
    }

    Object.assign(ingredient, updateIngredientDto);
    return await this.ingredientRepository.save(ingredient);
  }

  async remove(id: string) {
    const ingredient = await this.findOne(id);
    try {
      return await this.ingredientRepository.remove(ingredient);
    } catch (error: any) {
      if (
        error instanceof QueryFailedError &&
        (error as any).code === '23503'
      ) {
        throw new BadRequestException(
          'Cannot delete ingredient: it is used in existing cocktail recipes. Remove references first or merge with another ingredient.',
        );
      }
      throw error;
    }
  }
}
