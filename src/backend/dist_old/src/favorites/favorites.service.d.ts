import { Repository } from 'typeorm';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { Favorite } from './entities/favorite.entity';
import { User } from '../users/entities/user.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
export declare class FavoritesService {
    private readonly favoriteRepository;
    private readonly userRepository;
    constructor(favoriteRepository: Repository<Favorite>, userRepository: Repository<User>);
    create(dto: CreateFavoriteDto): Promise<Favorite>;
    findAll(paginationQuery: PaginationQueryDto): Promise<{
        data: Favorite[];
        meta: {
            currentPage: number;
            nextPage: number | null;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<Favorite>;
    update(id: string, updateFavoriteDto: UpdateFavoriteDto): Promise<Favorite>;
    remove(id: string): Promise<Favorite>;
}
