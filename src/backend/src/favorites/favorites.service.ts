import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { Favorite } from './entities/favorite.entity';
import { User } from '../users/entities/user.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { HiddenExternalCocktail } from '../cocktails/entities/hidden-external-cocktail.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CocktailAggregatorService } from '../cocktails/cocktail-aggregator.service';
import { isValidUUID } from '../utils/uuid-validator';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Cocktail)
    private readonly cocktailRepository: Repository<Cocktail>,
    @InjectRepository(HiddenExternalCocktail)
    private readonly hiddenRepository: Repository<HiddenExternalCocktail>,
    @Inject(forwardRef(() => CocktailAggregatorService))
    private readonly aggregatorService: CocktailAggregatorService,
  ) {}

  async countFavorites(cocktailId: string): Promise<number> {
    return await this.favoriteRepository.count({
      where: { cocktail: { id: cocktailId } },
    });
  }

  async create(userId: string, dto: CreateFavoriteDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const hasLocal = !!dto.cocktailId;
    const hasExternal = !!dto.externalCocktailId;

    if (hasLocal && hasExternal) {
      throw new BadRequestException(
        'Cannot favorite both a local and external cocktail simultaneously. Provide either cocktailId or externalCocktailId.',
      );
    }
    if (!hasLocal && !hasExternal) {
      throw new BadRequestException(
        'Either cocktailId or externalCocktailId must be provided.',
      );
    }
    if (hasLocal) {
      if (!isValidUUID(dto.cocktailId!)) {
        throw new NotFoundException(`Cocktail ${dto.cocktailId} not found`);
      }
      const cocktail = await this.cocktailRepository.findOne({
        where: { id: dto.cocktailId, isDeleted: false },
      });
      if (!cocktail)
        throw new NotFoundException(`Cocktail ${dto.cocktailId} not found`);
    }

    let externalName: string | null = null;
    if (dto.externalCocktailId) {
      try {
        const external = await this.aggregatorService.getExternalCocktailById(
          dto.externalCocktailId,
        );
        externalName = external?.name || null;
      } catch {
        // Best-effort: hydrate name later during find operations
      }
    }

    const favorite = this.favoriteRepository.create({
      user: user,
      cocktail: dto.cocktailId ? { id: dto.cocktailId } : undefined,
      externalCocktailId: dto.externalCocktailId || undefined,
      externalName: externalName,
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
      qb.andWhere(
        '(cocktail.name ILIKE :search OR favorite.externalName ILIKE :search)',
        { search: `%${search}%` },
      );
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
    const hiddenRecords = await this.hiddenRepository.find({
      select: ['externalId'],
    });
    const hiddenIds = new Set(hiddenRecords.map((r) => r.externalId));

    const externalIds = [
      ...new Set(
        favorites
          .filter(
            (f) =>
              f.externalCocktailId &&
              !f.cocktail &&
              !hiddenIds.has(f.externalCocktailId),
          )
          .map((f) => f.externalCocktailId!),
      ),
    ];

    const results: { id: string; cocktail: unknown }[] = [];
    if (externalIds.length > 0) {
      const hydrations = await Promise.all(
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
      results.push(...hydrations);
    }

    const cocktailMap = new Map(
      results.filter((r) => r.cocktail).map((r) => [r.id, r.cocktail]),
    );

    for (const fav of favorites) {
      if (fav.externalCocktailId && !fav.cocktail) {
        if (hiddenIds.has(fav.externalCocktailId)) {
          (fav as any).externalCocktailData = {
            id: `ext-${fav.externalCocktailId}`,
            name: 'Recipe hidden by administrator',
            isDeleted: true,
            description:
              'This recipe was removed by the bar manager for violating community guidelines.',
            ingredients: [],
          };
        } else if (cocktailMap.has(fav.externalCocktailId)) {
          const externalData = cocktailMap.get(fav.externalCocktailId);
          (fav as any).externalCocktailData = externalData;
          if (!fav.externalName && externalData) {
            fav.externalName =
              (externalData as any)?.strDrink ||
              (externalData as any)?.name ||
              null;
          }
        }
      }
    }
    // Persist any backfilled externalName values
    const toUpdate = favorites.filter(
      (f) => f.externalCocktailId && f.externalName && f.id,
    );
    if (toUpdate.length > 0) {
      try {
        await this.favoriteRepository.save(toUpdate);
      } catch {
        // Non-critical: backfill may race, ignore
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
      where: { user: { id: userId }, externalCocktailId: externalId },
    });
    if (favorite) {
      try {
        favorite.externalCocktailId = null;
        favorite.cocktail = { id: localId } as Cocktail;
        await this.favoriteRepository.save(favorite);
      } catch (error: any) {
        if (
          error?.code === '23505' ||
          error?.message?.includes('unique') ||
          error?.message?.includes('duplicate')
        ) {
          await this.favoriteRepository.remove(favorite);
          this.logger.log(
            `Silently resolved favorite migration collision for user ${userId} and cocktail ${localId}. Redundant favorite cleared.`,
          );
        } else {
          throw error;
        }
      }
    }
  }
}
