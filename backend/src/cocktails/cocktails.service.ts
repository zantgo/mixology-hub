import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateCocktailDto } from './dto/create-cocktail.dto';
import { UpdateCocktailDto } from './dto/update-cocktail.dto';
import { Cocktail } from './entities/cocktail.entity';
import { CocktailIngredient } from './entities/cocktail-ingredient.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';
import { PreparationLog } from './entities/preparation-log.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

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
  ) {}

  async create(
    createCocktailDto: CreateCocktailDto & { imageFull?: string; imageThumb?: string },
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
          user: user,
        });

        const savedCocktail = await transactionalEntityManager.save(newCocktail);

        for (const item of createCocktailDto.ingredients) {
          const ingredient = await transactionalEntityManager.findOne(Ingredient, {
            where: { id: item.ingredientId },
          });

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
    force: boolean = false,
  ) {
    const cocktail = await this.cocktailRepository.findOne({
      where: { id: cocktailId },
      relations: ['ingredients'],
    });

    if (!cocktail) {
      throw new NotFoundException(`Cocktail #${cocktailId} not found`);
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
      cocktailId,
      bartenderId,
      preparationLogId: savedLog.id,
      servings,
      force,
    });

    return {
      message: 'Cocktail preparation queued',
      preparationLogId: savedLog.id,
      jobId: job.id,
      status: 'queued',
      statusUrl: `/cocktails/preparations/${savedLog.id}/status`,
    };
  }

  async undo(logId: string) {
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

    const job = await this.barOrdersQueue.add('undo-preparation', {
      type: 'undo',
      bartenderId: log.bartenderId || undefined,
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
