import { CocktailsService } from './cocktails.service';
import { CocktailAggregatorService } from './cocktail-aggregator.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { User } from '../users/entities/user.entity';
import { ImageService } from '../images/image.service';
export declare class CocktailsController {
    private readonly cocktailsService;
    private readonly aggregatorService;
    private readonly imageService;
    constructor(cocktailsService: CocktailsService, aggregatorService: CocktailAggregatorService, imageService: ImageService);
    create(body: any, file: Express.Multer.File, user: User): Promise<import("./entities/cocktail.entity").Cocktail>;
    prepare(id: string, user: User): Promise<{
        message: string;
    }>;
    findAll(paginationQuery: PaginationQueryDto, name?: string): Promise<{
        data: import("./entities/cocktail.entity").Cocktail[];
        meta: {
            currentPage: number;
            nextPage: number | null;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
        };
    } | {
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
            filters: import("./cocktail-aggregator.service").SearchFilters;
            sort: {
                by: "name" | "popularity" | "makeability" | "complexity";
                order: "asc" | "desc";
            };
        };
    }>;
    findOne(id: string): Promise<import("./entities/cocktail.entity").Cocktail>;
    update(id: string, body: any, file: Express.Multer.File, user: User): Promise<import("./entities/cocktail.entity").Cocktail>;
    remove(id: string): Promise<import("./entities/cocktail.entity").Cocktail>;
}
