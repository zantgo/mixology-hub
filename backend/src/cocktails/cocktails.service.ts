import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCocktailDto } from './dto/create-cocktail.dto';
import { UpdateCocktailDto } from './dto/update-cocktail.dto';
import { Cocktail } from './entities/cocktail.entity';
import { CocktailIngredient } from './entities/cocktail-ingredient.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';

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
  ) {}

  async create(createCocktailDto: CreateCocktailDto) {
    // Obtenemos el usuario mockeado de la base de datos
    const mockUser = await this.userRepository.findOne({ 
        where: { email: 'mock@test.com' } 
    });

    if (!mockUser) {
        throw new NotFoundException('Mock user not found in database');
    }

    return await this.cocktailRepository.manager.transaction(async (transactionalEntityManager) => {
      // 1. Creamos la instancia del cóctel con el usuario obtenido de la BD
      const newCocktail = this.cocktailRepository.create({
        name: createCocktailDto.name,
        description: createCocktailDto.description,
        instructions: createCocktailDto.instructions,
        user: mockUser,
      });

      const savedCocktail = await transactionalEntityManager.save(newCocktail);

      // 2. Procesar ingredientes
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
        });

        await transactionalEntityManager.save(cocktailIngredient);
      }

      return savedCocktail;
    });
  }

  async findAll() {
    return await this.cocktailRepository.find({
      relations: ['ingredients', 'ingredients.ingredient'],
    });
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
    
    // Object.assign solo actualiza las propiedades del objeto cargado
    Object.assign(cocktail, updateCocktailDto);
    
    return await this.cocktailRepository.save(cocktail);
  }

  async remove(id: string) {
    const cocktail = await this.findOne(id);
    // Debido a onDelete: 'CASCADE' en la entidad, esto borrará los ingredientes relacionados automáticamente
    return await this.cocktailRepository.remove(cocktail);
  }
}
