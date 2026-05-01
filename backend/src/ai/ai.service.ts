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
import { IAiProvider } from '../external/ai-provider.interface';
import { ConfigService } from '@nestjs/config';
import { LlmAdapterService } from '../external/llm/llm-adapter.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(Ai) private readonly aiRepository: Repository<Ai>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Ingredient) private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(Cocktail) private readonly cocktailRepository: Repository<Cocktail>,
    private readonly llmAdapterService: LlmAdapterService,
    private readonly configService: ConfigService,
  ) {}

  private getAiProvider(): IAiProvider {
    // Always use the LLM adapter service
    return this.llmAdapterService;
  }

  async generateRecipe(createAiDto: CreateAiDto) {
    const mockUser = await this.userRepository.findOne({ where: { email: 'mock@test.com' } });
    if (!mockUser) throw new NotFoundException('Mock user not found.');

    const aiProvider = this.getAiProvider();
    const recipe = await aiProvider.generateRecipe(createAiDto.ingredients);

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
      // 1. Create the cocktail within the transaction
      const newCocktail = em.create(Cocktail, {
        name: saveDto.name,
        instructions: Array.isArray(recipe.instructions)
          ? recipe.instructions.join('\n')
          : recipe.instructions || '',
        user: aiRecord.user,
        source: 'ai'
      });
      const savedCocktail = await em.save(newCocktail);

      // 2. Process ingredients within the transaction
      for (const item of recipe.ingredients) {
        let ingredient = await em.findOne(Ingredient, { where: { name: item.name.toLowerCase() } });
        
        if (!ingredient) {
          ingredient = em.create(Ingredient, {
            name: item.name.toLowerCase(),
            baseUnit: this.determineBaseUnit(item.unit || 'count'),
          });
          ingredient = await em.save(ingredient);
        }

        // 3. Create the relationship using instances within the 'em' context
        const cocktailIngredient = em.create(CocktailIngredient, {
          cocktail: savedCocktail,
          ingredient: ingredient,
          measure: item.note || `${item.amount} ${item.unit}`,
          amount: item.amount || 1,
          unit: item.unit || 'count'
        });
        
        await em.save(cocktailIngredient);
      }
      return savedCocktail;
    });
  }

  private determineBaseUnit(unit: string): string {
    const unitMap: Record<string, string> = {
      'ml': 'ml', 'oz': 'ml', 'cl': 'ml', 'l': 'ml',
      'g': 'g', 'kg': 'g',
      'dash': 'dashes', 'drop': 'drops', 'splash': 'splashes',
      'part': 'parts', 'slice': 'slices', 'wedge': 'wedges',
      'twist': 'twists', 'sprig': 'sprigs', 'leaf': 'leaves',
    };
    return unitMap[unit.toLowerCase()] || 'count';
  }

  async findAll(paginationQuery: PaginationQueryDto) {
    const { limit = 10, page = 1 } = paginationQuery;
    const offset = (page - 1) * limit;
    const [data, total] = await this.aiRepository.findAndCount({
      relations: ['user'],
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
