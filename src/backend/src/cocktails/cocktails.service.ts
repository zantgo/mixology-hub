import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios from 'axios';
import { CreateCocktailDto } from './dto/create-cocktail.dto';
import { UpdateCocktailDto } from './dto/update-cocktail.dto';
import { Cocktail } from './entities/cocktail.entity';
import { CocktailIngredient } from './entities/cocktail-ingredient.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';
import { PreparationLog } from './entities/preparation-log.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { EnhancedTheCocktailDbService } from '../external/the-cocktail-db/enhanced-cocktail-db.service';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';
import { MeasureParserService } from '../utils/measure-parser.service';
import { FavoritesService } from '../favorites/favorites.service';
import { ImageService } from '../images/image.service';
import type { CocktailDbDrink } from './cocktail-aggregator.service';

@Injectable()
export class CocktailsService {
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
    private readonly externalCocktailService: EnhancedTheCocktailDbService,
    private readonly hierarchicalIngredientService: HierarchicalIngredientService,
    private readonly measureParser: MeasureParserService,
    @Inject(forwardRef(() => FavoritesService))
    private readonly favoritesService: FavoritesService,
    private readonly imageService: ImageService,
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

    const cocktail = await this.cocktailRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const newCocktail = this.cocktailRepository.create({
          name: createCocktailDto.name,
          description: createCocktailDto.description,
          instructions: createCocktailDto.instructions,
          image_full: createCocktailDto.imageFull,
          image_thumb: createCocktailDto.imageThumb,
          is_public: createCocktailDto.isPublic ?? true,
          parent_external_id: createCocktailDto.parentExternalId,
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

    return completeCocktail;
  }

  async prepare(
    cocktailId: string,
    bartenderId: string,
    servings: number = 1,
    totalVolumeMl?: number,
    force: boolean = false,
  ) {
    let cocktail = await this.cocktailRepository.findOne({
      where: { id: cocktailId },
      relations: ['ingredients'],
    });

    let forkedFromExternal = false;

    if (!cocktail) {
      const cleanExternalId = cocktailId.startsWith('ext-')
        ? cocktailId.slice(4)
        : cocktailId;
      const externalDrink: CocktailDbDrink | null =
        await this.externalCocktailService.getCocktailById(cleanExternalId);
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

      const imagePaths = await this.ingestExternalImage(
        externalDrink.strDrinkThumb || '',
      );

      cocktail = await this.create(
        {
          name: externalDrink.strDrink,
          description: externalDrink.strInstructions
            ? `Imported from TheCocktailDB: ${externalDrink.strInstructions.length > 100 ? externalDrink.strInstructions.substring(0, 100) + '...' : externalDrink.strInstructions}`
            : 'Imported from TheCocktailDB',
          instructions:
            externalDrink.strInstructions || 'No instructions provided',
          ingredients: resolvedIngredients,
          isPublic: true,
          parentExternalId: cocktailId,
          imageFull: imagePaths.full || undefined,
          imageThumb: imagePaths.thumb || undefined,
        },
        bartenderId,
      );

      forkedFromExternal = true;

      await this.favoritesService.migrateFavoritePointer(
        bartenderId,
        cleanExternalId,
        cocktail.id,
      );
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
      totalVolumeMl,
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

  private async ingestExternalImage(
    url: string,
  ): Promise<{ full: string | null; thumb: string | null }> {
    if (!url || !url.startsWith('https://')) {
      return { full: null, thumb: null };
    }

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
        return { full: null, thumb: null };
      }

      const buffer = Buffer.from(response.data as ArrayBuffer);
      return await this.imageService.processAndSaveBuffer(buffer, contentType);
    } catch {
      return { full: null, thumb: null };
    }
  }

  async undo(logId: string) {
    interface UndoQueryRow {
      id: string;
      bartender_id: string | null;
      cocktail_id: string | null;
      status: string;
      undone: boolean;
    }

    const result: UndoQueryRow[] =
      await this.preparationLogRepository.manager.query<UndoQueryRow>(
        `UPDATE preparation_logs
       SET undone = true
       WHERE id = $1
         AND status = 'completed'
         AND undone = false
       RETURNING *`,
        [logId],
      );

    if (!result || result.length === 0) {
      const log = await this.preparationLogRepository.findOne({
        where: { id: logId },
      });

      if (!log) {
        throw new NotFoundException(`Preparation log ${logId} not found`);
      }

      if (log.status !== 'completed') {
        throw new NotFoundException(
          `Cannot undo preparation: status is ${log.status}, expected "completed"`,
        );
      }

      if (log.undone) {
        throw new NotFoundException('Preparation has already been undone');
      }
    }

    const log = result[0];

    const jobType = log.cocktail_id ? 'undo' : 'batch-undo';

    const job = await this.barOrdersQueue.add('undo-preparation', {
      type: jobType,
      bartenderId: log.bartender_id || undefined,
      preparationLogId: log.id,
    });

    return {
      message: 'Undo queued for processing',
      preparationLogId: log.id,
      jobId: job.id,
      status: 'queued',
      statusUrl: `/cocktails/preparations/${log.id}/status`,
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
    const offset = (page - 1) * limit;
    const [data, total] = await this.cocktailRepository.findAndCount({
      where: { is_deleted: false },
      relations: ['ingredients'],
      skip: offset,
      take: limit,
    });

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

  async searchByName(
    name: string,
    paginationQuery: PaginationQueryDto,
    options?: { fuzzy?: boolean },
  ) {
    const { limit = 10, page = 1 } = paginationQuery;
    const offset = (page - 1) * limit;
    const normalized = name.trim().toLowerCase();

    const qb = this.cocktailRepository
      .createQueryBuilder('cocktail')
      .leftJoinAndSelect('cocktail.ingredients', 'ingredients')
      .where('cocktail.is_deleted = :isDeleted', { isDeleted: false });

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

  async findOne(id: string) {
    const cocktail = await this.cocktailRepository.findOne({
      where: { id, is_deleted: false },
      relations: ['ingredients'],
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

    Object.assign(cocktail, {
      ...updateCocktailDto,
      image_full: updateCocktailDto.imageFull,
      image_thumb: updateCocktailDto.imageThumb,
    });

    return await this.cocktailRepository.save(cocktail);
  }

  async remove(id: string, userId?: string) {
    const cocktail = await this.findOne(id);
    if (userId && cocktail.user?.id !== userId) {
      throw new NotFoundException(
        `Cocktail #${id} not found or you don't have permission to delete it`,
      );
    }
    cocktail.is_deleted = true;
    return await this.cocktailRepository.save(cocktail);
  }
}
