import { Injectable, NotFoundException, BadRequestException, forwardRef, InternalServerErrorException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Decimal } from 'decimal.js';
import { CreateCocktailDto } from './dto/create-cocktail.dto';
import { UpdateCocktailDto } from './dto/update-cocktail.dto';
import { Cocktail } from './entities/cocktail.entity';
import { CocktailIngredient } from './entities/cocktail-ingredient.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';
import { UserInventory } from '../users/entities/user-inventory.entity';
import { UserInventoryService } from '../users/user-inventory.service';
import { UnitConverterService } from '../utils/unit-converter.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class CocktailsService {
  constructor(
    @InjectRepository(Cocktail)
    private readonly cocktailRepository: Repository<Cocktail>,
    @InjectRepository(CocktailIngredient)
    private readonly cocktailIngredientRepository: Repository<CocktailIngredient>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(forwardRef(() => UserInventoryService))
    private readonly inventoryService: UserInventoryService,
    private readonly unitConverter: UnitConverterService,
  ) {}

  async create(createCocktailDto: CreateCocktailDto & { imageFull?: string; imageThumb?: string }, userId?: string): Promise<Cocktail> {
    let user: User | null;
    
    if (userId) {
      user = await this.userRepository.findOne({ 
        where: { id: userId } 
      });
    } else {
      // Fallback to mock user for backward compatibility
      user = await this.userRepository.findOne({ 
        where: { email: 'mock@test.com' } 
      });
    }

    if (!user) {
      throw new NotFoundException('User not found in database');
    }

    const cocktail = await this.cocktailRepository.manager.transaction(async (transactionalEntityManager) => {
      const newCocktail = this.cocktailRepository.create({
        name: createCocktailDto.name,
        description: createCocktailDto.description,
        instructions: createCocktailDto.instructions,
        image_full: createCocktailDto.imageFull,
        image_thumb: createCocktailDto.imageThumb,
        is_public: createCocktailDto.isPublic ?? true,
        user: user,
      });

      const savedCocktail = await transactionalEntityManager.save(newCocktail);

      for (const item of createCocktailDto.ingredients) {
        const ingredient = await transactionalEntityManager.findOne(Ingredient, {
          where: { id: item.ingredientId },
        });

        if (!ingredient) {
          throw new NotFoundException(`Ingredient with ID ${item.ingredientId} not found`);
        }

        const cocktailIngredient = this.cocktailIngredientRepository.create({
          cocktail: savedCocktail,
          ingredient: ingredient,
          measure: item.measure,
          amount: item.amount,
          unit: item.unit
        });

        await transactionalEntityManager.save(cocktailIngredient);
      }

      return savedCocktail;
    });

    // Load the complete cocktail with relations
    const completeCocktail = await this.cocktailRepository.findOne({
      where: { id: cocktail.id },
      relations: ['ingredients', 'ingredients.ingredient', 'user'],
    });

    if (!completeCocktail) {
      throw new InternalServerErrorException('Failed to retrieve created cocktail');
    }

    return completeCocktail;
  }

  async prepare(cocktailId: string, userId: string) {
    return await this.cocktailRepository.manager.transaction(async (transactionalEntityManager) => {
      const cocktail = await transactionalEntityManager.findOne(Cocktail, {
        where: { id: cocktailId },
        relations: ['ingredients', 'ingredients.ingredient'],
      });

      if (!cocktail) {
        throw new NotFoundException(`Cocktail #${cocktailId} not found`);
      }

      for (const req of cocktail.ingredients) {
        if (!req.ingredient || !req.ingredient.id) {
          throw new InternalServerErrorException('Cocktail recipe is corrupt: Missing ingredient data.');
        }

        const amountToSubtract = this.unitConverter.convert(req.amount, req.unit, req.ingredient.baseUnit, req.ingredient);

        const result = await transactionalEntityManager
          .createQueryBuilder()
          .update(UserInventory)
          .set({
            quantity: () => `quantity - :amount`,
          })
          .where('user_id = :userId', { userId })
          .andWhere('ingredient_id = :ingredientId', { ingredientId: req.ingredient.id })
          .andWhere('quantity >= :amount', { amount: amountToSubtract.toString() })
          .returning('*')
          .execute();

        if (!result.affected || result.affected === 0) {
          const stock = await transactionalEntityManager.findOne(UserInventory, {
            where: { user: { id: userId }, ingredient: { id: req.ingredient.id } },
          });
          throw new BadRequestException(
            `Not enough stock for ingredient: ${req.ingredient.name || 'Unknown'}`
          );
        }
      }

      return { message: `Cocktail ${cocktail.name} prepared successfully!` };
    });
  }

  async findAll(paginationQuery: PaginationQueryDto) {
    const { limit = 10, page = 1 } = paginationQuery;
    const offset = (page - 1) * limit;
    const [data, total] = await this.cocktailRepository.findAndCount({
      where: { is_deleted: false },
      relations: ['ingredients', 'ingredients.ingredient'],
      skip: offset,
      take: limit,
    });
    
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    
    return { 
      data, 
      meta: {
        currentPage: page,
        nextPage: hasNextPage ? page + 1 : null,
        itemsPerPage: limit,
        totalItems: total,
        totalPages
      }
    };
  }

  async findOne(id: string) {
    const cocktail = await this.cocktailRepository.findOne({
      where: { id, is_deleted: false },
      relations: ['ingredients', 'ingredients.ingredient'],
    });
    if (!cocktail) throw new NotFoundException(`Cocktail #${id} not found`);
    return cocktail;
  }

  async update(id: string, updateCocktailDto: UpdateCocktailDto & { imageFull?: string; imageThumb?: string }, userId?: string) {
    const cocktail = await this.findOne(id);
    
    // Check if user owns the cocktail (if userId is provided)
    if (userId && cocktail.user?.id !== userId) {
      throw new NotFoundException(`Cocktail #${id} not found or you don't have permission to update it`);
    }
    
    Object.assign(cocktail, {
      ...updateCocktailDto,
      image_full: updateCocktailDto.imageFull,
      image_thumb: updateCocktailDto.imageThumb,
    });
    
    return await this.cocktailRepository.save(cocktail);
  }

  async remove(id: string, userId?: string) {
    const cocktail = await this.findOne(id);
    if (userId && cocktail.user?.id !== userId) {
      throw new NotFoundException(`Cocktail #${id} not found or you don't have permission to delete it`);
    }
    return await this.cocktailRepository.remove(cocktail);
  }
}
