import { Repository } from 'typeorm';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { SaveAiRecipeDto } from './dto/save-ai-recipe.dto';
import { Ai } from './entities/ai.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { ConfigService } from '@nestjs/config';
import { LlmAdapterService } from '../external/llm/llm-adapter.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
export declare class AiService {
    private readonly aiRepository;
    private readonly userRepository;
    private readonly ingredientRepository;
    private readonly cocktailRepository;
    private readonly llmAdapterService;
    private readonly configService;
    private readonly logger;
    constructor(aiRepository: Repository<Ai>, userRepository: Repository<User>, ingredientRepository: Repository<Ingredient>, cocktailRepository: Repository<Cocktail>, llmAdapterService: LlmAdapterService, configService: ConfigService);
    private getAiProvider;
    generateRecipe(createAiDto: CreateAiDto): Promise<Ai>;
    saveAsCocktail(id: string, saveDto: SaveAiRecipeDto): Promise<Cocktail>;
    findAll(paginationQuery: PaginationQueryDto): Promise<{
        data: Ai[];
        meta: {
            currentPage: number;
            nextPage: number | null;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<Ai>;
    update(id: string, updateAiDto: UpdateAiDto): Promise<Ai>;
    remove(id: string): Promise<Ai>;
}
