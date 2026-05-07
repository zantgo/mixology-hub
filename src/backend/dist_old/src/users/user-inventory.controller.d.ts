import { UserInventoryService } from './user-inventory.service';
import { AddInventoryDto } from './dto/add-inventory.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CheckMakeabilityDto } from './dto/check-makeability.dto';
import { DepleteInventoryDto } from './dto/deplete-inventory.dto';
export declare class UserInventoryController {
    private readonly inventoryService;
    constructor(inventoryService: UserInventoryService);
    add(req: any, dto: AddInventoryDto): Promise<import("./entities/user-inventory.entity").UserInventory>;
    findAll(req: any): Promise<import("./entities/user-inventory.entity").UserInventory[]>;
    getSummary(req: any): Promise<{
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
    getMakeableCocktails(req: any, paginationQuery: PaginationQueryDto): Promise<{
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
        data: import("../cocktails/entities/cocktail.entity").Cocktail[];
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
    checkMakeability(req: any, dto: CheckMakeabilityDto): Promise<import("./user-inventory.service").MakeabilityResult>;
    depleteInventory(req: any, dto: DepleteInventoryDto): Promise<{
        success: boolean;
        depletedItems: Array<{
            ingredientId: string;
            amountDepleted: number;
        }>;
    }>;
    update(req: any, id: string, quantity: number, unit: string): Promise<import("./entities/user-inventory.entity").UserInventory>;
    remove(req: any, id: string): Promise<import("./entities/user-inventory.entity").UserInventory>;
}
