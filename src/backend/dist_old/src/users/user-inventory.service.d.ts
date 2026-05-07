import { Repository, DataSource } from 'typeorm';
import { UserInventory } from './entities/user-inventory.entity';
import { AddInventoryDto } from './dto/add-inventory.dto';
import { UsersService } from './users.service';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { UnitConverterService } from '../utils/unit-converter.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CheckMakeabilityDto } from './dto/check-makeability.dto';
import { DepleteInventoryDto } from './dto/deplete-inventory.dto';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';
export interface MakeabilityResult {
    isMakeable: boolean;
    missingIngredients: Array<{
        ingredientId: string;
        ingredientName: string;
        requiredAmount: number;
        requiredUnit: string;
        availableAmount: number;
        availableUnit: string;
        missingAmount: number;
    }>;
    substitutions: Array<{
        requiredIngredientId: string;
        requiredIngredientName: string;
        substitutedWithId: string;
        substitutedWithName: string;
    }>;
}
export declare class UserInventoryService {
    private readonly inventoryRepository;
    private readonly ingredientRepository;
    private readonly cocktailRepository;
    private readonly usersService;
    private readonly unitConverter;
    private readonly hierarchicalIngredientService;
    private readonly dataSource;
    private readonly MAX_ITERATIONS;
    constructor(inventoryRepository: Repository<UserInventory>, ingredientRepository: Repository<Ingredient>, cocktailRepository: Repository<Cocktail>, usersService: UsersService, unitConverter: UnitConverterService, hierarchicalIngredientService: HierarchicalIngredientService, dataSource: DataSource);
    addToInventory(userId: string, dto: AddInventoryDto): Promise<UserInventory>;
    getInventory(userId: string): Promise<UserInventory[]>;
    removeFromInventory(userId: string, inventoryItemId: string): Promise<UserInventory>;
    updateInventoryItem(userId: string, inventoryItemId: string, quantity: number, unit: string): Promise<UserInventory>;
    checkMakeability(userId: string, dto: CheckMakeabilityDto): Promise<MakeabilityResult>;
    private findMatchingInventoryItem;
    depleteInventory(userId: string, dto: DepleteInventoryDto): Promise<{
        success: boolean;
        depletedItems: Array<{
            ingredientId: string;
            amountDepleted: number;
        }>;
    }>;
    getMakeableCocktails(userId: string, paginationQuery: PaginationQueryDto): Promise<{
        data: never[];
        meta: {
            currentPage: number;
            nextPage: null;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
            iterations?: undefined;
            maxIterations?: undefined;
            warning?: undefined;
        };
    } | {
        data: Cocktail[];
        meta: {
            currentPage: number;
            nextPage: number | null;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
            iterations: number;
            maxIterations: number;
            warning: string | null;
        };
    }>;
    getInventorySummary(userId: string): Promise<{
        totalItems: number;
        totalVolumeMl: number;
        categories: string[];
        lowStockItems: {
            id: string;
            ingredientName: string;
            quantity: number;
            unit: string;
        }[];
    }>;
}
