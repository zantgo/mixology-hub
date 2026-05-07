import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
export declare class FavoritesController {
    private readonly favoritesService;
    constructor(favoritesService: FavoritesService);
    create(createFavoriteDto: CreateFavoriteDto): Promise<import("./entities/favorite.entity").Favorite>;
    findAll(paginationQuery: PaginationQueryDto): Promise<{
        data: import("./entities/favorite.entity").Favorite[];
        meta: {
            currentPage: number;
            nextPage: number | null;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<import("./entities/favorite.entity").Favorite>;
    update(id: string, updateFavoriteDto: UpdateFavoriteDto): Promise<import("./entities/favorite.entity").Favorite>;
    remove(id: string): Promise<import("./entities/favorite.entity").Favorite>;
}
