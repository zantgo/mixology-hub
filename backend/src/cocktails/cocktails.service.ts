import { Injectable, NotFoundException, BadRequestException, forwardRef, InternalServerErrorException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCocktailDto } from './dto/create-cocktail.dto';
import { UpdateCocktailDto } from './dto/update-cocktail.dto';
import { Cocktail } from './entities/cocktail.entity';
import { CocktailIngredient } from './entities/cocktail-ingredient.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';
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

  async create(createCocktailDto: CreateCocktailDto) {
    const mockUser = await this.userRepository.findOne({ 
        where: { email: 'mock@test.com' } 
    });

    if (!mockUser) {
        throw new NotFoundException('Mock user not found in database');
    }

    return await this.cocktailRepository.manager.transaction(async (transactionalEntityManager) => {
      const newCocktail = this.cocktailRepository.create({
        name: createCocktailDto.name,
        description: createCocktailDto.description,
        instructions: createCocktailDto.instructions,
        user: mockUser,
      });

      const savedCocktail = await transactionalEntityManager.save(newCocktail);

      for (const item of createCocktailDto.ingredients) {
        const ingredient = await this.ingredientRepository.findOne({
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
  }

  async prepare(cocktailId: string) {
    return await this.cocktailRepository.manager.transaction(async (transactionalEntityManager) => {
      const cocktail = await this.findOne(cocktailId);
      const inventoryPaginated = await this.inventoryService.getUserInventory({ limit: 10000, offset: 0 }); // Use a high limit for internal calculation
      const inventory = inventoryPaginated.data;

      for (const req of cocktail.ingredients) {
        if (!req.ingredient || !req.ingredient.id) {
            throw new InternalServerErrorException('Cocktail recipe is corrupt: Missing ingredient data.');
        }

        const stock = inventory.find(i => i.ingredient && i.ingredient.id === req.ingredient.id);
        
        if (!stock || !this.unitConverter.hasEnoughStock(Number(stock.quantity), stock.unit, req.amount, req.unit)) {
          throw new BadRequestException(`Not enough stock for ingredient: ${req.ingredient.name || 'Unknown'}`);
        }
      }

      for (const req of cocktail.ingredients) {
        const stock = inventory.find(i => i.ingredient.id === req.ingredient.id);
        if (stock) {
            const amountToSubtract = this.unitConverter.convert(req.amount, req.unit, stock.unit);
            stock.quantity -= amountToSubtract;
            await transactionalEntityManager.save(stock);
        }
      }

      return { message: `Cocktail ${cocktail.name} prepared successfully!` };
    });
  }

  async findAll(paginationQuery: PaginationQueryDto) {
    const { limit = 10, offset = 0 } = paginationQuery;
    const [data, total] = await this.cocktailRepository.findAndCount({
      relations: ['ingredients', 'ingredients.ingredient'],
      skip: offset,
      take: limit,
    });
    
    return { data, total, limit, offset };
  }

  async findOne(id: string) {
    const cocktail = await this.cocktailRepository.findOne({
      where: { id },
      relations: ['ingredients', 'ingredients.ingredient'],
    });
    if (!cocktail) throw new NotFoundException(`Cocktail #${id} not found`);
    return cocktail;
  }

  async update(id: string, updateCocktailDto: UpdateCocktailDto) {
    const cocktail = await this.findOne(id);
    Object.assign(cocktail, updateCocktailDto);
    return await this.cocktailRepository.save(cocktail);
  }

  async remove(id: string) {
    const cocktail = await this.findOne(id);
    return await this.cocktailRepository.remove(cocktail);
  }
}
