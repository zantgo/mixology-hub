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

  async generateRecipe(createAiDto: CreateAiDto, user: User) {
    const aiProvider = this.getAiProvider();
    const recipe = await aiProvider.generateRecipe(createAiDto.ingredients);

    const aiRecipe = this.aiRepository.create({
      prompt: `Ingredients: ${createAiDto.ingredients.join(', ')}`,
      generated_recipe: recipe,
      user,
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

      // 2. Bulk lookup existing ingredients to avoid N+1 queries
      const ingredientNames = recipe.ingredients.map((item: any) => item.name.toLowerCase());
      const normalizedNames = ingredientNames.map((n: string) => n.toUpperCase().trim());
      const existingIngredients = await em.find(Ingredient, {
        where: normalizedNames.map((name: string) => ({ normalizedName: name })),
      });
      const ingredientMap = new Map(existingIngredients.map((i) => [i.normalizedName.toLowerCase(), i]));

      for (const item of recipe.ingredients) {
        const lookupName = item.name.toLowerCase();
        let ingredient = ingredientMap.get(lookupName);

        if (!ingredient) {
          ingredient = em.create(Ingredient, {
            name: lookupName,
            baseUnit: this.determineBaseUnit(item.unit || 'count'),
          });
          ingredient = await em.save(ingredient);
          ingredientMap.set(lookupName, ingredient);
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

  async findAll(paginationQuery: PaginationQueryDto, userId?: string) {
    const { limit = 10, page = 1 } = paginationQuery;
    const offset = (page - 1) * limit;
    const where: any = {};
    if (userId) {
      where.user = { id: userId };
    }
    const [data, total] = await this.aiRepository.findAndCount({
      where,
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

  async findOne(id: string, userId?: string) {
    const where: any = { id };
    if (userId) {
      where.user = { id: userId };
    }
    const aiRecipe = await this.aiRepository.findOne({ where, relations: ['user'] });
    if (!aiRecipe) throw new NotFoundException(`AI generated recipe with ID ${id} not found`);
    return aiRecipe;
  }

  async update(id: string, updateAiDto: UpdateAiDto, userId?: string) {
    const aiRecipe = await this.findOne(id, userId);
    Object.assign(aiRecipe, updateAiDto);
    return await this.aiRepository.save(aiRecipe);
  }

  async remove(id: string, userId?: string) {
    const aiRecipe = await this.findOne(id, userId);
    return await this.aiRepository.remove(aiRecipe);
  }
}
