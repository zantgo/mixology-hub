import { IngredientsService } from './ingredients.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
export declare class IngredientsController {
    private readonly ingredientsService;
    constructor(ingredientsService: IngredientsService);
    create(createIngredientDto: CreateIngredientDto): Promise<import("./entities/ingredient.entity").Ingredient>;
    findAll(paginationQuery: PaginationQueryDto): Promise<{
        data: import("./entities/ingredient.entity").Ingredient[];
        meta: {
            currentPage: number;
            nextPage: number | null;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<import("./entities/ingredient.entity").Ingredient>;
    update(id: string, updateIngredientDto: UpdateIngredientDto): Promise<import("./entities/ingredient.entity").Ingredient>;
    remove(id: string): Promise<import("./entities/ingredient.entity").Ingredient>;
}
