import { AiService } from './ai.service';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { SaveAiRecipeDto } from './dto/save-ai-recipe.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
export declare class AiController {
    private readonly aiService;
    constructor(aiService: AiService);
    create(createAiDto: CreateAiDto): Promise<import("./entities/ai.entity").Ai>;
    saveAsCocktail(id: string, saveDto: SaveAiRecipeDto): Promise<import("../cocktails/entities/cocktail.entity").Cocktail>;
    findAll(paginationQuery: PaginationQueryDto): Promise<{
        data: import("./entities/ai.entity").Ai[];
        meta: {
            currentPage: number;
            nextPage: number | null;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<import("./entities/ai.entity").Ai>;
    update(id: string, updateAiDto: UpdateAiDto): Promise<import("./entities/ai.entity").Ai>;
    remove(id: string): Promise<import("./entities/ai.entity").Ai>;
}
