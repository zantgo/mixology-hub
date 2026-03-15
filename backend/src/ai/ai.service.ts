import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { SaveAiRecipeDto } from './dto/save-ai-recipe.dto';
import { Ai } from './entities/ai.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { PollinationsAiService } from '../external/pollinations-ai/pollinations-ai.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(Ai) private readonly aiRepository: Repository<Ai>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Ingredient) private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(Cocktail) private readonly cocktailRepository: Repository<Cocktail>,
    private readonly aiProvider: PollinationsAiService,
  ) {}

  async generateRecipe(createAiDto: CreateAiDto) {
    const mockUser = await this.userRepository.findOne({ where: { email: 'mock@test.com' } });
    if (!mockUser) throw new NotFoundException('Mock user not found.');

    const recipe = await this.aiProvider.generateRecipe(createAiDto.ingredients);

    const aiRecipe = this.aiRepository.create({
      prompt: `Ingredients: ${createAiDto.ingredients.join(', ')}`,
      generated_recipe: recipe,
      user: mockUser,
    });
    
    return await this.aiRepository.save(aiRecipe);
  }

  async saveAsCocktail(id: string, saveDto: SaveAiRecipeDto) {
    const aiRecord = await this.findOne(id);
    const recipe = aiRecord.generated_recipe;

    return await this.cocktailRepository.manager.transaction(async (em) => {
      // 1. Crear el cóctel dentro de la transacción
      const newCocktail = em.create(Cocktail, {
        name: saveDto.name,
        instructions: recipe.instructions,
        user: aiRecord.user,
        source: 'ai'
      });
      const savedCocktail = await em.save(newCocktail);

      // 2. Procesar ingredientes dentro de la transacción
      for (const item of recipe.ingredients) {
        let ingredient = await em.findOne(Ingredient, { where: { name: item.name.toLowerCase() } });
        
        if (!ingredient) {
          ingredient = em.create(Ingredient, { name: item.name.toLowerCase(), baseUnit: 'ml' });
          ingredient = await em.save(ingredient);
        }

        // 3. Crear relación usando las instancias dentro del contexto 'em'
        const cocktailIngredient = em.create(CocktailIngredient, {
          cocktail: savedCocktail,
          ingredient: ingredient,
          measure: item.measure,
          amount: 1, // Valor por defecto
          unit: 'ml'
        });
        
        await em.save(cocktailIngredient);
      }
      return savedCocktail;
    });
  }

  async findAll(paginationQuery: PaginationQueryDto) {
    const { limit = 10, offset = 0 } = paginationQuery;
    const [data, total] = await this.aiRepository.findAndCount({
      relations: ['user'],
      skip: offset,
      take: limit,
    });
    return { data, total, limit, offset };
  }

  async findOne(id: string) {
    const aiRecipe = await this.aiRepository.findOne({ where: { id }, relations: ['user'] });
    if (!aiRecipe) throw new NotFoundException(`AI generated recipe with ID ${id} not found`);
    return aiRecipe;
  }

  async update(id: string, updateAiDto: UpdateAiDto) {
    const aiRecipe = await this.findOne(id);
    Object.assign(aiRecipe, updateAiDto);
    return await this.aiRepository.save(aiRecipe);
  }

  async remove(id: string) {
    const aiRecipe = await this.findOne(id);
    return await this.aiRepository.remove(aiRecipe);
  }
}
