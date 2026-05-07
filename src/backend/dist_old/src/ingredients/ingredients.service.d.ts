import { Repository } from 'typeorm';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
export declare class IngredientsService {
    private readonly ingredientRepository;
    constructor(ingredientRepository: Repository<Ingredient>);
    create(createIngredientDto: CreateIngredientDto): Promise<Ingredient>;
    findAll(paginationQuery: PaginationQueryDto): Promise<{
        data: Ingredient[];
        meta: {
            currentPage: number;
            nextPage: number | null;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<Ingredient>;
    update(id: string, updateIngredientDto: UpdateIngredientDto): Promise<Ingredient>;
    remove(id: string): Promise<Ingredient>;
}
