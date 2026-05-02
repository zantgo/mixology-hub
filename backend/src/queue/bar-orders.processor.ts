import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Decimal } from 'decimal.js';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { PreparationLog } from '../cocktails/entities/preparation-log.entity';
import { UnitConverterService } from '../utils/unit-converter.service';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';

interface PrepareJobPayload {
  cocktailId: string;
  bartenderId: string;
  preparationLogId: string;
  servings: number;
  force?: boolean;
}

@Processor('bar-orders', { concurrency: 1 })
@Injectable()
export class BarOrdersProcessor extends WorkerHost {
  private readonly logger = new Logger(BarOrdersProcessor.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(BarInventory)
    private readonly barInventoryRepository: Repository<BarInventory>,
    @InjectRepository(Cocktail)
    private readonly cocktailRepository: Repository<Cocktail>,
    @InjectRepository(PreparationLog)
    private readonly preparationLogRepository: Repository<PreparationLog>,
    private readonly unitConverter: UnitConverterService,
    private readonly hierarchicalIngredientService: HierarchicalIngredientService,
  ) {
    super();
  }

  async process(job: Job<PrepareJobPayload>): Promise<{ status: string; logId: string }> {
    const { cocktailId, bartenderId, preparationLogId, servings, force } = job.data;
    this.logger.log(`Processing prepare job for cocktail ${cocktailId}, bartender ${bartenderId}`);

    return await this.dataSource.transaction(async (transactionalEntityManager) => {
      const preparationLog = await transactionalEntityManager.findOne(PreparationLog, {
        where: { id: preparationLogId },
      });
      if (!preparationLog) {
        throw new Error(`PreparationLog ${preparationLogId} not found`);
      }

      const cocktail = await transactionalEntityManager.findOne(Cocktail, {
        where: { id: cocktailId },
        relations: ['ingredients'],
      });
      if (!cocktail) {
        preparationLog.status = 'failed_other';
        await transactionalEntityManager.save(preparationLog);
        throw new Error(`Cocktail ${cocktailId} not found`);
      }

      const deductions: Record<string, unknown>[] = [];

      for (const req of cocktail.ingredients) {
        if (!req.ingredient || !req.ingredient.id) {
          preparationLog.status = 'failed_other';
          await transactionalEntityManager.save(preparationLog);
          throw new Error('Cocktail recipe is corrupt: Missing ingredient data.');
        }

        const amountPerServing = this.unitConverter.convert(
          req.amount,
          req.unit,
          req.ingredient.baseUnit,
          req.ingredient,
        );
        const totalAmount = amountPerServing.times(new Decimal(servings));

        const barStock = await transactionalEntityManager
          .createQueryBuilder(BarInventory, 'bi')
          .setLock('pessimistic_write')
          .where('bi.ingredient_id = :ingredientId', {
            ingredientId: req.ingredient.id,
          })
          .getOne();

        const currentQuantity = barStock ? barStock.quantity : new Decimal(0);

        if (currentQuantity.lessThan(totalAmount)) {
          if (force) {
            deductions.push({
              ingredientId: req.ingredient.id,
              ingredientName: req.ingredient.name,
              required: totalAmount.toString(),
              deducted: new Decimal(0).toString(),
              skipped: true,
            });
            continue;
          }

          preparationLog.status = 'failed_insufficient_stock';
          await transactionalEntityManager.save(preparationLog);
          this.logger.warn(
            `Insufficient stock for ingredient ${req.ingredient.name}: ` +
            `have ${currentQuantity}, need ${totalAmount}`,
          );
          return { status: 'failed_insufficient_stock', logId: preparationLogId };
        }

        const result = await transactionalEntityManager
          .createQueryBuilder()
          .update(BarInventory)
          .set({ quantity: () => `quantity - ${totalAmount.toString()}` })
          .where('ingredient_id = :ingredientId', {
            ingredientId: req.ingredient.id,
          })
          .andWhere('quantity >= :amount', {
            amount: totalAmount.toString(),
          })
          .execute();

        if (!result.affected || result.affected === 0) {
          preparationLog.status = 'failed_insufficient_stock';
          await transactionalEntityManager.save(preparationLog);
          return { status: 'failed_insufficient_stock', logId: preparationLogId };
        }

        deductions.push({
          ingredientId: req.ingredient.id,
          ingredientName: req.ingredient.name,
          amount: totalAmount.toString(),
          unit: req.ingredient.baseUnit,
          unitConverted: {
            from: { amount: req.amount.toString(), unit: req.unit },
            to: { amount: totalAmount.toString(), unit: req.ingredient.baseUnit },
          },
        });
      }

      preparationLog.status = 'completed';
      preparationLog.deductedIngredients = deductions;
      preparationLog.cocktailNameSnapshot = cocktail.name;
      preparationLog.servings = servings;
      await transactionalEntityManager.save(preparationLog);

      this.logger.log(
        `Successfully prepared cocktail ${cocktail.name} (${servings} serving(s))`,
      );
      return { status: 'completed', logId: preparationLogId };
    }).catch(async (error) => {
      this.logger.error(`Failed to process prepare job: ${error.message}`);

      try {
        await this.preparationLogRepository.update(preparationLogId, {
          status: 'failed_other',
        });
      } catch (updateError) {
        this.logger.error(`Failed to update preparation log status: ${updateError}`);
      }

      throw error;
    });
  }
}
