import type { Cache } from 'cache-manager';
import { CocktailsService } from './cocktails.service';
import { EnhancedTheCocktailDbService } from '../external/the-cocktail-db/enhanced-cocktail-db.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UserInventoryService } from '../users/user-inventory.service';
export interface SearchFilters {
    ingredient?: string;
    category?: string;
    alcoholic?: boolean;
    glassType?: string;
    maxIngredients?: number;
    minIngredients?: number;
}
export interface SearchOptions {
    includeExternal?: boolean;
    includeLocal?: boolean;
    includeAI?: boolean;
    sortBy?: 'name' | 'popularity' | 'makeability' | 'complexity';
    sortOrder?: 'asc' | 'desc';
    filters?: SearchFilters;
}
export declare class CocktailAggregatorService {
    private readonly localService;
    private readonly externalService;
    private readonly inventoryService;
    private cacheManager;
    private readonly logger;
    constructor(localService: CocktailsService, externalService: EnhancedTheCocktailDbService, inventoryService: UserInventoryService, cacheManager: Cache);
    searchUnified(name: string, paginationQuery: PaginationQueryDto, options?: SearchOptions, userId?: string): Promise<{
        data: any[];
        meta: {
            currentPage: number;
            nextPage: number | null;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
        };
        metadata: {
            sources: {
                local: number;
                external: number;
                total: number;
            };
            filters: SearchFilters;
            sort: {
                by: "name" | "popularity" | "makeability" | "complexity";
                order: "asc" | "desc";
            };
        };
    } | {
        data: never[];
        meta: {
            currentPage: number;
            nextPage: null;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
        };
        metadata: {
            error: string;
            sources: {
                local: number;
                external: number;
                total: number;
            };
        };
    }>;
    private applyFilters;
    private calculateMakeabilityScores;
    private calculateMakeabilityScore;
    private sortCocktails;
    private mapExternalToLocal;
    private parseMeasure;
    private calculateComplexityScore;
    private generateSearchCacheKey;
    private fetchSearchResults;
    private fetchLocalCocktails;
    private fetchExternalCocktails;
}
