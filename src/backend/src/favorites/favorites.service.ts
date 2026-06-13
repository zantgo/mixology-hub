import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { Favorite } from './entities/favorite.entity';
import { User } from '../users/entities/user.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CocktailAggregatorService } from '../cocktails/cocktail-aggregator.service';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Cocktail)
    private readonly cocktailRepository: Repository<Cocktail>,
    private readonly aggregatorService: CocktailAggregatorService,
  ) {}

  async create(userId: string, dto: CreateFavoriteDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.cocktailId) {
      const cocktail = await this.cocktailRepository.findOne({
        where: { id: dto.cocktailId, is_deleted: false },
      });
      if (!cocktail)
        throw new NotFoundException(`Cocktail ${dto.cocktailId} not found`);
    }

    const favorite = this.favoriteRepository.create({
      user: user,
      cocktail: dto.cocktailId ? { id: dto.cocktailId } : undefined,
      external_cocktail_id: dto.externalCocktailId || undefined,
    });

    return await this.favoriteRepository.save(favorite);
  }

  async findAll(
    userId: string,
    paginationQuery: PaginationQueryDto,
    search?: string,
  ) {
    const { limit = 10, page = 1 } = paginationQuery;
    const offset = (page - 1) * limit;

    const qb = this.favoriteRepository
      .createQueryBuilder('favorite')
      .leftJoinAndSelect('favorite.cocktail', 'cocktail')
      .where('favorite.user_id = :userId', { userId });
    // Soft-deleted cocktails are included to allow frontend tombstone rendering (UC 6.6)

    if (search) {
      qb.andWhere('cocktail.name ILIKE :search', { search: `%${search}%` });
    }

    qb.skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();

    await this.hydrateExternalFavorites(data);

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;

    return {
      data,
      meta: {
        currentPage: page,
        nextPage: hasNextPage ? page + 1 : null,
        itemsPerPage: limit,
        totalItems: total,
        totalPages,
      },
    };
  }

  private async hydrateExternalFavorites(favorites: Favorite[]): Promise<void> {
    const externalIds = [
      ...new Set(
        favorites
          .filter((f) => f.external_cocktail_id && !f.cocktail)
          .map((f) => f.external_cocktail_id!),
      ),
    ];

    if (externalIds.length === 0) return;

    const results = await Promise.all(
      externalIds.map(async (id) => {
        try {
          const cocktail =
            await this.aggregatorService.getExternalCocktailById(id);
          return { id, cocktail };
        } catch {
          return { id, cocktail: null };
        }
      }),
    );

    const cocktailMap = new Map(
      results.filter((r) => r.cocktail).map((r) => [r.id, r.cocktail]),
    );

    for (const fav of favorites) {
      if (
        fav.external_cocktail_id &&
        !fav.cocktail &&
        cocktailMap.has(fav.external_cocktail_id)
      ) {
        (fav as any).external_cocktail_data = cocktailMap.get(
          fav.external_cocktail_id,
        );
      }
    }
  }

  async findOne(userId: string, id: string) {
    const favorite = await this.favoriteRepository.findOne({
      where: { id, user: { id: userId } },
      relations: ['user', 'cocktail'],
    });

    if (!favorite) {
      throw new NotFoundException(`Favorite with ID ${id} not found`);
    }

    await this.hydrateExternalFavorites([favorite]);

    return favorite;
  }

  async update(
    userId: string,
    id: string,
    updateFavoriteDto: UpdateFavoriteDto,
  ) {
    const favorite = await this.findOne(userId, id);

    if (updateFavoriteDto.cocktailId !== undefined) {
      favorite.cocktail = updateFavoriteDto.cocktailId
        ? ({ id: updateFavoriteDto.cocktailId } as any)
        : null;
    }

    if (updateFavoriteDto.externalCocktailId !== undefined) {
      favorite.external_cocktail_id =
        updateFavoriteDto.externalCocktailId || null;
    }

    return await this.favoriteRepository.save(favorite);
  }

  async remove(userId: string, id: string) {
    const favorite = await this.findOne(userId, id);
    return await this.favoriteRepository.remove(favorite);
  }

  async migrateFavoritePointer(
    userId: string,
    externalId: string,
    localId: string,
  ): Promise<void> {
    const favorite = await this.favoriteRepository.findOne({
      where: { user: { id: userId }, external_cocktail_id: externalId },
    });
    if (favorite) {
      favorite.external_cocktail_id = null;
      favorite.cocktail = { id: localId } as Cocktail;
      await this.favoriteRepository.save(favorite);
    }
  }
}
