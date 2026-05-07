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
export declare class CocktailsService {
    private readonly cocktailRepository;
    private readonly cocktailIngredientRepository;
    private readonly ingredientRepository;
    private readonly userRepository;
    private readonly inventoryService;
    private readonly unitConverter;
    constructor(cocktailRepository: Repository<Cocktail>, cocktailIngredientRepository: Repository<CocktailIngredient>, ingredientRepository: Repository<Ingredient>, userRepository: Repository<User>, inventoryService: UserInventoryService, unitConverter: UnitConverterService);
    create(createCocktailDto: CreateCocktailDto & {
        imageFull?: string;
        imageThumb?: string;
    }, userId?: string): Promise<Cocktail>;
    prepare(cocktailId: string, userId: string): Promise<{
        message: string;
    }>;
    findAll(paginationQuery: PaginationQueryDto): Promise<{
        data: Cocktail[];
        meta: {
            currentPage: number;
            nextPage: number | null;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<Cocktail>;
    update(id: string, updateCocktailDto: UpdateCocktailDto & {
        imageFull?: string;
        imageThumb?: string;
    }, userId?: string): Promise<Cocktail>;
    remove(id: string): Promise<Cocktail>;
}
