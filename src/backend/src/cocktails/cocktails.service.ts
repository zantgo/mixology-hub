import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios from 'axios';
import { Decimal } from 'decimal.js';
import { CreateCocktailDto } from './dto/create-cocktail.dto';
import { UpdateCocktailDto } from './dto/update-cocktail.dto';
import { Cocktail } from './entities/cocktail.entity';
import { CocktailIngredient } from './entities/cocktail-ingredient.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';
import { PreparationLog } from './entities/preparation-log.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CocktailDbService } from '../external/the-cocktail-db/cocktail-db.service';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';
import { MeasureParserService } from '../utils/measure-parser.service';
import { FavoritesService } from '../favorites/favorites.service';
import { RatingService } from './rating.service';
import { ImageService } from '../images/image.service';
import { CacheInvalidationService } from '../redis-cache/cache-invalidation.service';
import { isValidUUID } from '../utils/uuid-validator';
import { COCKTAIL_EVENTS } from '../common/events/cocktail-events';
import type { CocktailDbDrink } from './cocktail-aggregator.service';

@Injectable()
export class CocktailsService {
  private readonly logger = new Logger(CocktailsService.name);
  constructor(
    @InjectRepository(Cocktail)
    private readonly cocktailRepository: Repository<Cocktail>,
    @InjectRepository(CocktailIngredient)
    private readonly cocktailIngredientRepository: Repository<CocktailIngredient>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PreparationLog)
    private readonly preparationLogRepository: Repository<PreparationLog>,
    @InjectQueue('bar-orders')
    private readonly barOrdersQueue: Queue,
    private readonly cocktailDbService: CocktailDbService,
    private readonly hierarchicalIngredientService: HierarchicalIngredientService,
    private readonly measureParser: MeasureParserService,
    private readonly favoritesService: FavoritesService,
    private readonly ratingService: RatingService,
    private readonly imageService: ImageService,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  async create(
    createCocktailDto: CreateCocktailDto & {
      imageFull?: string;
      imageThumb?: string;
      parentExternalId?: string;
    },
    userId: string,
  ): Promise<Cocktail> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const parentExternalId = createCocktailDto.parentExternalId?.startsWith(
      'ext-',
    )
      ? createCocktailDto.parentExternalId.slice(4)
      : createCocktailDto.parentExternalId;

    const cocktail = await this.cocktailRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const newCocktail = this.cocktailRepository.create({
          name: createCocktailDto.name,
          description: createCocktailDto.description,
          instructions: createCocktailDto.instructions,
          imageFull: createCocktailDto.imageFull,
          imageThumb: createCocktailDto.imageThumb,
          isPublic: createCocktailDto.isPublic ?? true,
          parentExternalId: parentExternalId,
          user: user,
        });

        const savedCocktail =
          await transactionalEntityManager.save(newCocktail);

        for (const item of createCocktailDto.ingredients) {
          const ingredient = await transactionalEntityManager.findOne(
            Ingredient,
            {
              where: { id: item.ingredientId },
            },
          );

          if (!ingredient) {
            throw new NotFoundException(
              `Ingredient with ID ${item.ingredientId} not found`,
            );
          }

          const cocktailIngredient = transactionalEntityManager.create(
            CocktailIngredient,
            {
              cocktail: savedCocktail,
              ingredient: ingredient,
              measure: item.measure,
              amount: item.amount,
              unit: item.unit,
            },
          );

          await transactionalEntityManager.save(cocktailIngredient);
        }

        return savedCocktail;
      },
    );

    const completeCocktail = await this.cocktailRepository.findOne({
      where: { id: cocktail.id },
      relations: ['ingredients', 'user'],
    });

    if (!completeCocktail) {
      throw new InternalServerErrorException(
        'Failed to retrieve created cocktail',
      );
    }

    if (parentExternalId) {
      await this.favoritesService
        .migrateFavoritePointer(userId, parentExternalId, completeCocktail.id)
        .catch(() => {});
    }

    return completeCocktail;
  }

  async prepare(
    cocktailId: string,
    bartenderId: string,
    servings: number = 1,
    totalVolumeMl?: string,
    force: boolean = false,
  ) {
    let totalVolumeMlDecimal: Decimal | undefined;
    if (totalVolumeMl !== undefined && totalVolumeMl.trim() !== '') {
      try {
        totalVolumeMlDecimal = new Decimal(totalVolumeMl);
      } catch {
        throw new BadRequestException('Total volume must be a valid number');
      }
      if (totalVolumeMlDecimal.isNaN() || totalVolumeMlDecimal.lte(0)) {
        throw new BadRequestException('Total volume must be a positive number');
      }
      if (totalVolumeMlDecimal.gt(10000)) {
        throw new BadRequestException(
          'Total volume exceeds maximum allowed (10000 ml)',
        );
      }
    }

    let cocktail = isValidUUID(cocktailId)
      ? await this.cocktailRepository.findOne({
          where: { id: cocktailId },
          relations: ['ingredients'],
        })
      : null;

    let forkedFromExternal = false;

    if (!cocktail) {
      const cleanExternalId = cocktailId.startsWith('ext-')
        ? cocktailId.slice(4)
        : cocktailId;

      cocktail = await this.cocktailRepository.findOne({
        where: { parentExternalId: cleanExternalId, isDeleted: false },
        relations: ['ingredients'],
      });

      if (cocktail) {
        forkedFromExternal = true;
      }

      if (!cocktail) {
        const externalDrink: CocktailDbDrink | null =
          await this.cocktailDbService.getCocktailById(cleanExternalId);
        if (!externalDrink || !externalDrink.strDrink) {
          throw new NotFoundException(`Cocktail #${cocktailId} not found`);
        }

        const unresolved: string[] = [];
        const resolvedIngredients: {
          ingredientId: string;
          measure: string;
          amount: number;
          unit: string;
        }[] = [];

        for (let i = 1; i <= 15; i++) {
          const ingredientKey = `strIngredient${i}` as const;
          const measureKey = `strMeasure${i}` as const;
          const ingredientName: string | null = externalDrink[ingredientKey];
          const measure: string | null = externalDrink[measureKey];

          if (!ingredientName || ingredientName.trim() === '') continue;

          const match = await this.hierarchicalIngredientService.findBestMatch(
            ingredientName.trim(),
            {
              minConfidence: 0.7,
            },
          );

          if (!match) {
            unresolved.push(ingredientName.trim().toLowerCase());
            continue;
          }

          const parsed = this.measureParser.parse(measure ?? '');

          resolvedIngredients.push({
            ingredientId: match.ingredient.id,
            measure: measure ? measure.trim() : 'to taste',
            amount: parsed.amount,
            unit: parsed.unit,
          });
        }

        if (unresolved.length > 0) {
          throw new BadRequestException(
            `Cannot prepare external cocktail: the following ingredients are not recognized in the bar inventory: ${unresolved.join(', ')}`,
          );
        }

        if (resolvedIngredients.length === 0) {
          throw new BadRequestException(
            'External cocktail has no resolvable ingredients',
          );
        }

        cocktail = await this.create(
          {
            name: externalDrink.strDrink,
            description: externalDrink.strInstructions
              ? // eslint-disable-next-line no-restricted-syntax
                `Imported from TheCocktailDB: ${externalDrink.strInstructions.length > 100 ? externalDrink.strInstructions.substring(0, 100) + '...' : externalDrink.strInstructions}`
              : 'Imported from TheCocktailDB',
            instructions:
              externalDrink.strInstructions || 'No instructions provided',
            ingredients: resolvedIngredients,
            isPublic: true,
            parentExternalId: cleanExternalId,
          },
          bartenderId,
        );

        if (externalDrink.strDrinkThumb?.startsWith('https://')) {
          const newCocktailId = cocktail.id;
          this.ingestAndUpdateCocktailImage(
            newCocktailId,
            externalDrink.strDrinkThumb,
          ).catch((err: Error) =>
            this.logger.warn(
              `Background image ingestion failed for cocktail ${newCocktailId}: ${err.message}`,
            ),
          );
        }

        forkedFromExternal = true;

        await this.favoritesService
          .migrateFavoritePointer(bartenderId, cleanExternalId, cocktail.id)
          .catch(() => {});

        await this.ratingService
          .migrateExternalRating(bartenderId, cleanExternalId, cocktail.id)
          .catch(() => {});
      }
    }

    const preparationLog = this.preparationLogRepository.create({
      bartenderId,
      cocktailId: cocktail.id,
      cocktailNameSnapshot: cocktail.name,
      servings,
      status: 'queued',
    });
    const savedLog = await this.preparationLogRepository.save(preparationLog);

    const job = await this.barOrdersQueue.add('prepare-cocktail', {
      type: 'prepare',
      cocktailId: cocktail.id,
      bartenderId,
      preparationLogId: savedLog.id,
      servings,
      totalVolumeMl: totalVolumeMlDecimal?.toString(),
      force,
    });

    return {
      message: 'Cocktail preparation queued',
      preparationLogId: savedLog.id,
      jobId: job.id,
      status: 'queued',
      statusUrl: `/cocktails/preparations/${savedLog.id}/status`,
      ...(forkedFromExternal ? { forkedFromExternal: true } : {}),
    };
  }

  async batchPrepare(
    bartenderId: string,
    orders: Array<{ cocktailId: string; servings?: number; force?: boolean }>,
  ) {
    if (!orders?.length)
      throw new BadRequestException('At least one order is required');

    const preparationLog = this.preparationLogRepository.create({
      bartenderId,
      cocktailNameSnapshot: `Batch: ${orders.length} cocktails`,
      servings: orders.length,
      status: 'queued',
    });
    const savedLog = await this.preparationLogRepository.save(preparationLog);

    const job = await this.barOrdersQueue.add('batch-prepare-cocktail', {
      type: 'batch-prepare',
      bartenderId,
      preparationLogId: savedLog.id,
      batchOrders: orders,
    });

    return {
      message: 'Batch preparation queued',
      preparationLogId: savedLog.id,
      jobId: job.id,
      status: 'queued',
      statusUrl: `/cocktails/preparations/${savedLog.id}/status`,
    };
  }

  private async ingestAndUpdateCocktailImage(
    cocktailId: string,
    url: string,
  ): Promise<void> {
    // eslint-disable-next-line no-restricted-syntax
    const MAX_CONTENT_LENGTH = 5 * 1024 * 1024;
    const TIMEOUT_MS = 3000;

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: TIMEOUT_MS,
        maxContentLength: MAX_CONTENT_LENGTH,
      });

      const contentType: string | undefined = Array.isArray(
        response.headers['content-type'],
      )
        ? response.headers['content-type'][0]
        : (response.headers['content-type'] as string | undefined);
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!contentType || !allowedTypes.includes(contentType)) {
        return;
      }

      const buffer = Buffer.from(response.data as ArrayBuffer);
      const paths = await this.imageService.processAndSaveBuffer(
        buffer,
        contentType,
      );

      await this.cocktailRepository.update(cocktailId, {
        imageFull: paths.full,
        imageThumb: paths.thumb,
      });
    } catch {
      // Best-effort: cocktail is already saved without image
    }
  }

  async undo(logId: string) {
    const log = await this.preparationLogRepository.findOne({
      where: { id: logId },
    });

    if (!log) {
      throw new NotFoundException(`Preparation log ${logId} not found`);
    }

    if (log.status !== 'completed') {
      throw new BadRequestException(
        `Cannot undo preparation: status is ${log.status}, expected "completed"`,
      );
    }

    if (log.undone) {
      throw new BadRequestException('Preparation has already been undone');
    }

    // eslint-disable-next-line no-restricted-syntax
    const MAX_UNDO_WINDOW_MS = 16 * 60 * 1000;
    // eslint-disable-next-line no-restricted-syntax
    const elapsed = Date.now() - new Date(log.createdAt).getTime();
    if (elapsed > MAX_UNDO_WINDOW_MS) {
      throw new BadRequestException(
        'Transaction Rollback Refused: The 15-minute secure undo window has expired.',
      );
    }

    interface UndoQueryRow {
      id: string;
      bartender_id: string | null;
      cocktail_id: string | null;
      status: string;
      undone: boolean;
    }

    const result: UndoQueryRow[] =
      await this.preparationLogRepository.manager.query<UndoQueryRow[]>(
        `SELECT * FROM preparation_logs
        WHERE id = $1
          AND status = 'completed'
          AND undone = false`,
        [logId],
      );

    if (!result || result.length === 0) {
      throw new BadRequestException(
        'Failed to queue undo. The preparation may have been modified.',
      );
    }

    const updatedLog = result[0];

    const jobType = updatedLog.cocktail_id ? 'undo' : 'batch-undo';

    const job = await this.barOrdersQueue.add('undo-preparation', {
      type: jobType,
      bartenderId: updatedLog.bartender_id || undefined,
      preparationLogId: updatedLog.id,
    });

    return {
      message: 'Undo queued for processing',
      preparationLogId: updatedLog.id,
      jobId: job.id,
      status: 'queued',
      statusUrl: `/cocktails/preparations/${updatedLog.id}/status`,
    };
  }

  async getPreparationStatus(logId: string) {
    const log = await this.preparationLogRepository.findOne({
      where: { id: logId },
    });

    if (!log) {
      throw new NotFoundException(`Preparation log ${logId} not found`);
    }

    return {
      preparationLogId: log.id,
      cocktailName: log.cocktailNameSnapshot,
      servings: log.servings,
      status: log.status,
      deductedIngredients: log.deductedIngredients,
      undone: log.undone,
      createdAt: log.createdAt,
    };
  }

  async cancelPreparation(logId: string) {
    const log = await this.preparationLogRepository.findOne({
      where: { id: logId },
    });

    if (!log) {
      throw new NotFoundException(`Preparation log ${logId} not found`);
    }

    if (
      log.status === 'completed' ||
      log.status === 'cancelled' ||
      log.status.startsWith('failed')
    ) {
      throw new BadRequestException(
        `Cannot cancel preparation: Order is already in a terminal state (${log.status})`,
      );
    }

    if (log.status === 'preparing') {
      throw new BadRequestException(
        'Cannot cancel preparation: Order is already being prepared',
      );
    }

    log.status = 'cancelled';
    const savedLog = await this.preparationLogRepository.save(log);

    return {
      message: 'Preparation cancelled successfully',
      preparationLogId: savedLog.id,
      status: 'cancelled',
    };
  }

  async findAll(paginationQuery: PaginationQueryDto) {
    const { limit = 10, page = 1 } = paginationQuery;
    // eslint-disable-next-line no-restricted-syntax
    const offset = (page - 1) * limit;
    const [data, total] = await this.cocktailRepository.findAndCount({
      where: { isDeleted: false },
      relations: ['ingredients'],
      skip: offset,
      take: limit,
    });

    // eslint-disable-next-line no-restricted-syntax
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;

    return {
      data,
      meta: {
        currentPage: page,
        // eslint-disable-next-line no-restricted-syntax
        nextPage: hasNextPage ? page + 1 : null,
        itemsPerPage: limit,
        totalItems: total,
        totalPages,
      },
    };
  }

  async searchByName(
    name: string,
    paginationQuery: PaginationQueryDto,
    options?: { fuzzy?: boolean },
  ) {
    const { limit = 10, page = 1 } = paginationQuery;
    // eslint-disable-next-line no-restricted-syntax
    const offset = (page - 1) * limit;
    const normalized = name.trim().toLowerCase();

    const qb = this.cocktailRepository
      .createQueryBuilder('cocktail')
      .leftJoinAndSelect('cocktail.ingredients', 'ingredients')
      .where('cocktail.isDeleted = :isDeleted', { isDeleted: false });

    if (options?.fuzzy) {
      qb.andWhere(
        'cocktail.name % :name OR similarity(cocktail.name, :name) > 0.3',
        { name: normalized },
      );
      qb.addSelect('similarity(cocktail.name, :name)', 'search_score');
      qb.orderBy('search_score', 'DESC');
    } else {
      qb.andWhere('LOWER(cocktail.name) LIKE :name', {
        name: `%${normalized}%`,
      });
    }

    qb.skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();

    // eslint-disable-next-line no-restricted-syntax
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;

    return {
      data,
      meta: {
        currentPage: page,
        // eslint-disable-next-line no-restricted-syntax
        nextPage: hasNextPage ? page + 1 : null,
        itemsPerPage: limit,
        totalItems: total,
        totalPages,
      },
    };
  }

  async findOne(id: string) {
    if (!isValidUUID(id)) {
      throw new NotFoundException(`Cocktail #${id} not found`);
    }
    const cocktail = await this.cocktailRepository.findOne({
      where: { id, isDeleted: false },
      relations: ['ingredients', 'ingredients.ingredient', 'user'],
    });
    if (!cocktail) throw new NotFoundException(`Cocktail #${id} not found`);
    return cocktail;
  }

  async update(
    id: string,
    updateCocktailDto: UpdateCocktailDto & {
      imageFull?: string;
      imageThumb?: string;
    },
    userId?: string,
  ) {
    const cocktail = await this.findOne(id);

    if (userId && cocktail.user?.id !== userId) {
      throw new NotFoundException(
        `Cocktail #${id} not found or you don't have permission to update it`,
      );
    }

    const favoritesCount = await this.favoritesService.countFavorites(id);
    if (cocktail.isPublic && favoritesCount > 0) {
      const newForkDto = {
        name: updateCocktailDto.name ?? cocktail.name,
        description: updateCocktailDto.description ?? cocktail.description,
        instructions: updateCocktailDto.instructions ?? cocktail.instructions,
        isPublic: true,
        ingredients:
          updateCocktailDto.ingredients ??
          cocktail.ingredients.map((ci) => ({
            ingredientId: ci.ingredient.id,
            amount:
              ci.amount instanceof Decimal
                ? ci.amount.toNumber()
                : Number(ci.amount),
            unit: ci.unit,
            measure: ci.measure,
          })),
        parentExternalId: cocktail.id,
      };

      const newFork = await this.create(newForkDto, userId!);
      await this.cacheInvalidation.clearByPatterns([
        'search:*',
        'makeability:*',
      ]);
      return newFork;
    }

    Object.assign(cocktail, {
      ...updateCocktailDto,
      imageFull: updateCocktailDto.imageFull,
      imageThumb: updateCocktailDto.imageThumb,
    });

    const saved = await this.cocktailRepository.save(cocktail);
    await this.cacheInvalidation.clearByPatterns(['search:*', 'makeability:*']);
    return saved;
  }

  async remove(id: string, userId?: string) {
    const cocktail = await this.findOne(id);
    if (userId && cocktail.user?.id !== userId) {
      throw new NotFoundException(
        `Cocktail #${id} not found or you don't have permission to delete it`,
      );
    }
    cocktail.isDeleted = true;
    const saved = await this.cocktailRepository.save(cocktail);
    await this.cacheInvalidation.clearByPatterns(['search:*', 'makeability:*']);
    return saved;
  }

  @OnEvent(COCKTAIL_EVENTS.FIND_ALL)
  async handleFindAll(payload: { limit?: number; page?: number }) {
    return this.findAll({
      limit: payload.limit ?? 100,
      page: payload.page ?? 1,
    });
  }
}
