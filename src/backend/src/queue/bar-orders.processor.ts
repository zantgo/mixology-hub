import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Decimal } from 'decimal.js';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { PreparationLog } from '../cocktails/entities/preparation-log.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { UnitConverterService } from '../utils/unit-converter.service';

export interface PrepareJobPayload {
  type: 'prepare' | 'undo' | 'batch-prepare' | 'batch-undo';
  cocktailId?: string;
  bartenderId: string;
  preparationLogId: string;
  servings?: number;
  totalVolumeMl?: number;
  force?: boolean;
  batchOrders?: Array<{
    cocktailId: string;
    servings?: number;
    force?: boolean;
  }>;
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
  ) {
    super();
  }

  async process(
    job: Job<PrepareJobPayload>,
  ): Promise<{ status: string; logId: string }> {
    switch (job.data.type) {
      case 'undo':
        return this.processUndo(job);
      case 'batch-prepare':
        return this.processBatchPrepare(job);
      case 'batch-undo':
        return this.processBatchUndo(job);
      default:
        return this.processPrepare(job);
    }
  }

  private async processPrepare(
    job: Job<PrepareJobPayload>,
  ): Promise<{ status: string; logId: string }> {
    const {
      cocktailId,
      bartenderId,
      preparationLogId,
      servings = 1,
      totalVolumeMl,
      force,
    } = job.data;
    this.logger.log(
      `Processing prepare job for cocktail ${cocktailId}, bartender ${bartenderId}`,
    );

    return await this.dataSource
      .transaction(async (transactionalEntityManager) => {
        const preparationLog = await transactionalEntityManager.findOne(
          PreparationLog,
          {
            where: { id: preparationLogId },
          },
        );
        if (!preparationLog) {
          throw new Error(`PreparationLog ${preparationLogId} not found`);
        }

        if (preparationLog.status === 'cancelled') {
          this.logger.log(
            `Preparation job ${preparationLogId} skipped because it was cancelled.`,
          );
          return { status: 'cancelled', logId: preparationLogId };
        }

        preparationLog.status = 'evaluating';
        await transactionalEntityManager.save(preparationLog);

        const cocktail = await transactionalEntityManager.findOne(Cocktail, {
          where: { id: cocktailId },
          relations: ['ingredients'],
        });
        if (!cocktail) {
          preparationLog.status = 'failed_other';
          await transactionalEntityManager.save(preparationLog);
          throw new Error(`Cocktail ${cocktailId} not found`);
        }

        const allStock = await transactionalEntityManager
          .createQueryBuilder(BarInventory, 'bi')
          .innerJoinAndSelect('bi.ingredient', 'ingredient')
          .setLock('pessimistic_write')
          .getMany();

        const deductions: Record<string, unknown>[] = [];
        const remainingStock = new Map(
          allStock.map((row) => [row.id, { row, quantity: row.quantity }]),
        );
        let preparingSet = false;

        const partBased = cocktail.ingredients.some(
          (i) => i.unit === 'part' || i.unit === 'parts',
        );
        let partSize = new Decimal(30);
        if (partBased) {
          const totalParts = cocktail.ingredients.reduce(
            (sum, i) =>
              sum.plus(
                i.unit === 'part' || i.unit === 'parts'
                  ? new Decimal(i.amount)
                  : new Decimal(0),
              ),
            new Decimal(0),
          );
          if (totalVolumeMl && totalParts.gt(0)) {
            partSize = new Decimal(totalVolumeMl).div(totalParts);
          }
        }

        for (const req of cocktail.ingredients) {
          if (!req.ingredient || !req.ingredient.id) {
            preparationLog.status = 'failed_other';
            await transactionalEntityManager.save(preparationLog);
            throw new Error(
              'Cocktail recipe is corrupt: Missing ingredient data.',
            );
          }

          let totalAmount: Decimal;
          if (req.unit === 'part' || req.unit === 'parts') {
            const calculatedMl = partSize.times(new Decimal(req.amount));
            totalAmount = this.unitConverter.convert(
              calculatedMl,
              'ml',
              req.ingredient.baseUnit,
              req.ingredient,
            );
          } else {
            const safeAmount = req.amount ? req.amount : new Decimal(0);
            const amountPerServing = this.unitConverter.convert(
              safeAmount,
              req.unit,
              req.ingredient.baseUnit,
              req.ingredient,
            );
            totalAmount = amountPerServing.times(new Decimal(servings));
          }

          const requiredName = req.ingredient.name.toLowerCase().trim();

          const eligible: Array<{ rowId: string; quantity: Decimal }> = [];
          for (const [rowId, entry] of remainingStock) {
            const row = entry.row;
            if (!row.ingredient) continue;

            const rowName = row.ingredient.name.toLowerCase().trim();
            const synNames = row.ingredient.synonyms
              ? row.ingredient.synonyms
                  .split(',')
                  .map((s) => s.toLowerCase().trim())
              : [];

            if (
              row.ingredient.id === req.ingredient.id ||
              rowName === requiredName ||
              synNames.includes(requiredName)
            ) {
              eligible.push({ rowId, quantity: entry.quantity });
            }
          }

          let remainingToDeduct = new Decimal(totalAmount);
          const allocations: Array<{
            rowId: string;
            amount: Decimal;
            name: string;
          }> = [];

          eligible.sort((a, b) => b.quantity.comparedTo(a.quantity));

          const reqAny = req as Record<string, unknown>;
          const isOptional =
            reqAny.is_optional === true ||
            reqAny.type === 'garnish' ||
            reqAny.type === 'rinse';

          let totalAvailable = new Decimal(0);
          for (const stockUnit of eligible) {
            totalAvailable = totalAvailable.plus(stockUnit.quantity);
          }

          if (totalAvailable.lt(totalAmount)) {
            if (force || isOptional) {
              deductions.push({
                ingredientId: req.ingredient.id,
                ingredientName: req.ingredient.name,
                required: totalAmount.toString(),
                deducted: new Decimal(0).toString(),
                skipped: true,
                optional: isOptional || undefined,
              });
              continue;
            }

            preparationLog.status = 'failed_insufficient_stock';
            await transactionalEntityManager.save(preparationLog);
            return {
              status: 'failed_insufficient_stock',
              logId: preparationLogId,
            };
          }

          for (const stockUnit of eligible) {
            if (remainingToDeduct.isZero()) break;
            const entry = remainingStock.get(stockUnit.rowId)!;
            const deductAmt = Decimal.min(remainingToDeduct, entry.quantity);

            if (deductAmt.gt(0)) {
              allocations.push({
                rowId: stockUnit.rowId,
                amount: deductAmt,
                name: entry.row.ingredient.name,
              });
              remainingToDeduct = remainingToDeduct.minus(deductAmt);
            }
          }

          if (!preparingSet && allocations.length > 0) {
            const currentLog = await transactionalEntityManager.findOne(
              PreparationLog,
              { where: { id: preparationLogId } },
            );
            if (currentLog?.status === 'cancelled') {
              return { status: 'cancelled', logId: preparationLogId };
            }
            preparationLog.status = 'preparing';
            await transactionalEntityManager.save(preparationLog);
            preparingSet = true;
          }

          for (const alloc of allocations) {
            const result = await transactionalEntityManager
              .createQueryBuilder()
              .update(BarInventory)
              .set({ quantity: () => `quantity - ${alloc.amount.toString()}` })
              .where('id = :rowId', { rowId: alloc.rowId })
              .andWhere('quantity >= :amount', {
                amount: alloc.amount.toString(),
              })
              .execute();

            if (!result.affected || result.affected === 0) {
              preparationLog.status = 'failed_insufficient_stock';
              await transactionalEntityManager.save(preparationLog);
              return {
                status: 'failed_insufficient_stock',
                logId: preparationLogId,
              };
            }

            const entry = remainingStock.get(alloc.rowId)!;
            entry.quantity = entry.quantity.minus(alloc.amount);

            deductions.push({
              ingredientId: req.ingredient.id,
              ingredientName: req.ingredient.name,
              amount: alloc.amount.toString(),
              unit: req.ingredient.baseUnit,
              actualInventoryRow: alloc.name,
              inventoryRowId: alloc.rowId,
            });
          }
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
      })
      .catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to process prepare job: ${message}`);

        try {
          await this.preparationLogRepository.update(preparationLogId, {
            status: 'failed_other',
          });
        } catch {
          // Best-effort status update — ignore failures
        }

        throw error;
      });
  }

  private async processBatchPrepare(
    job: Job<PrepareJobPayload>,
  ): Promise<{ status: string; logId: string }> {
    const { bartenderId, preparationLogId, batchOrders = [] } = job.data;
    this.logger.log(
      `Processing batch prepare (${batchOrders.length} orders) for bartender ${bartenderId}`,
    );

    return await this.dataSource
      .transaction(async (tx) => {
        const log = await tx.findOne(PreparationLog, {
          where: { id: preparationLogId },
        });
        if (!log)
          throw new Error(`PreparationLog ${preparationLogId} not found`);

        if (log.status === 'cancelled') {
          this.logger.log(
            `Batch preparation job ${preparationLogId} skipped because it was cancelled.`,
          );
          return { status: 'cancelled', logId: preparationLogId };
        }

        log.status = 'evaluating';
        await tx.save(log);

        const allDeductions: Record<string, unknown>[] = [];
        let preparingSet = false;

        for (const order of batchOrders) {
          const cocktail = await tx.findOne(Cocktail, {
            where: { id: order.cocktailId },
            relations: ['ingredients'],
          });
          if (!cocktail) {
            log.status = 'failed_other';
            await tx.save(log);
            throw new Error(`Cocktail ${order.cocktailId} not found in batch`);
          }

          for (const req of cocktail.ingredients) {
            if (!req.ingredient?.id) continue;

            const safeAmount = req.amount ? req.amount : new Decimal(0);
            const amountPerServing = this.unitConverter.convert(
              safeAmount,
              req.unit,
              req.ingredient.baseUnit,
              req.ingredient,
            );
            const totalAmount = amountPerServing.times(
              new Decimal(order.servings || 1),
            );

            const barStock = await tx
              .createQueryBuilder(BarInventory, 'bi')
              .setLock('pessimistic_write')
              .where('bi.ingredient_id = :ingredientId', {
                ingredientId: req.ingredient.id,
              })
              .getOne();

            const currentQuantity = barStock
              ? barStock.quantity
              : new Decimal(0);
            const reqAny = req as Record<string, unknown>;
            const isOptional =
              reqAny.is_optional === true ||
              reqAny.type === 'garnish' ||
              reqAny.type === 'rinse';

            if (currentQuantity.lessThan(totalAmount)) {
              if (order.force || isOptional) {
                allDeductions.push({
                  ingredientId: req.ingredient.id,
                  ingredientName: req.ingredient.name,
                  required: totalAmount.toString(),
                  deducted: new Decimal(0).toString(),
                  skipped: true,
                  cocktailId: order.cocktailId,
                  cocktailName: cocktail.name,
                });
                continue;
              }

              log.status = 'failed_insufficient_stock';
              await tx.save(log);
              return {
                status: 'failed_insufficient_stock',
                logId: preparationLogId,
              };
            }

            if (!preparingSet) {
              const currentLog = await tx.findOne(PreparationLog, {
                where: { id: preparationLogId },
              });
              if (currentLog?.status === 'cancelled') {
                return { status: 'cancelled', logId: preparationLogId };
              }
              log.status = 'preparing';
              await tx.save(log);
              preparingSet = true;
            }

            await tx
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

            allDeductions.push({
              ingredientId: req.ingredient.id,
              ingredientName: req.ingredient.name,
              amount: totalAmount.toString(),
              unit: req.ingredient.baseUnit,
              cocktailId: order.cocktailId,
              cocktailName: cocktail.name,
            });
          }
        }

        log.status = 'completed';
        log.deductedIngredients = allDeductions;
        log.cocktailNameSnapshot = `Batch: ${batchOrders.length} cocktails`;
        log.servings = batchOrders.length;
        await tx.save(log);

        return { status: 'completed', logId: preparationLogId };
      })
      .catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Batch prepare failed: ${message}`);
        try {
          await this.preparationLogRepository.update(preparationLogId, {
            status: 'failed_other',
          });
        } catch {
          // Best-effort status update — ignore failures
        }
        throw error;
      });
  }

  private async processBatchUndo(
    job: Job<PrepareJobPayload>,
  ): Promise<{ status: string; logId: string }> {
    const { bartenderId, preparationLogId } = job.data;
    this.logger.log(
      `Processing batch undo for log ${preparationLogId}, bartender ${bartenderId}`,
    );

    return await this.dataSource.transaction(async (tx) => {
      const log = await tx.findOne(PreparationLog, {
        where: { id: preparationLogId },
      });
      if (!log) throw new Error(`PreparationLog ${preparationLogId} not found`);
      if (log.status !== 'completed')
        throw new Error(
          `Cannot undo batch: status is ${log.status}, expected "completed"`,
        );
      if (log.undone) throw new Error(`Batch has already been undone`);

      const deductions = log.deductedIngredients;
      if (!deductions?.length) throw new Error(`No deductions found for batch`);

      for (const deduction of deductions) {
        if (deduction.skipped) continue;

        const ingredientId = deduction.ingredientId as string;
        const amount = deduction.amount as string;

        if (!ingredientId || !amount) continue;

        const ingredient = await tx.findOne(Ingredient, {
          where: { id: ingredientId },
        });

        if (!ingredient) {
          throw new Error(
            `Internal Server Error: Cannot restore inventory. Ingredient taxonomy has been mutated. Missing ID: ${ingredientId}`,
          );
        }

        const barStock = await tx
          .createQueryBuilder(BarInventory, 'bi')
          .setLock('pessimistic_write')
          .where('bi.ingredient_id = :ingredientId', { ingredientId })
          .getOne();

        if (!barStock) {
          const newStock = tx.create(BarInventory, {
            ingredient,
            quantity: new Decimal(amount),
            expirationDate: null,
          });
          await tx.save(newStock);
          this.logger.log(
            `Recreated deleted inventory row for ${String(deduction.ingredientName)} with ${amount}`,
          );
          continue;
        }

        await tx
          .createQueryBuilder()
          .update(BarInventory)
          .set({ quantity: () => `quantity + ${amount}` })
          .where('ingredient_id = :ingredientId', { ingredientId })
          .execute();
      }

      log.undone = true;
      await tx.save(log);
      return { status: 'undone', logId: preparationLogId };
    });
  }

  private async processUndo(
    job: Job<PrepareJobPayload>,
  ): Promise<{ status: string; logId: string }> {
    const { bartenderId, preparationLogId } = job.data;
    this.logger.log(
      `Processing undo job for preparation log ${preparationLogId}, bartender ${bartenderId}`,
    );

    return await this.dataSource
      .transaction(async (transactionalEntityManager) => {
        const preparationLog = await transactionalEntityManager.findOne(
          PreparationLog,
          {
            where: { id: preparationLogId },
          },
        );
        if (!preparationLog) {
          throw new Error(`PreparationLog ${preparationLogId} not found`);
        }

        if (preparationLog.status !== 'completed') {
          throw new Error(
            `Cannot undo preparation log ${preparationLogId}: status is ${preparationLog.status}, expected "completed"`,
          );
        }

        if (preparationLog.undone) {
          throw new Error(
            `Preparation log ${preparationLogId} has already been undone`,
          );
        }

        const deductions = preparationLog.deductedIngredients;
        if (!deductions || deductions.length === 0) {
          throw new Error(
            `No deductions found for preparation log ${preparationLogId}`,
          );
        }

        for (const deduction of deductions) {
          if (deduction.skipped) {
            continue;
          }

          const ingredientId = deduction.ingredientId as string;
          const amount = deduction.amount as string;
          const rowId = deduction.inventoryRowId as string;

          const ingredient = await transactionalEntityManager.findOne(
            Ingredient,
            {
              where: { id: ingredientId },
            },
          );

          if (!ingredient) {
            throw new Error(
              `Internal Server Error: Cannot restore inventory. Ingredient taxonomy has been mutated. Missing ID: ${ingredientId}`,
            );
          }

          let barStock = await transactionalEntityManager.findOne(
            BarInventory,
            {
              where: { id: rowId },
            },
          );

          if (!barStock) {
            barStock = transactionalEntityManager.create(BarInventory, {
              id: rowId,
              ingredient,
              quantity: new Decimal(amount),
              expirationDate: null,
            });
            await transactionalEntityManager.save(barStock);
          } else {
            await transactionalEntityManager
              .createQueryBuilder()
              .update(BarInventory)
              .set({ quantity: () => `quantity + ${amount}` })
              .where('id = :rowId', { rowId })
              .execute();
          }

          this.logger.log(
            `Restored ${amount} of ${String(deduction.ingredientName)} (${ingredientId})`,
          );
        }

        preparationLog.undone = true;
        await transactionalEntityManager.save(preparationLog);

        this.logger.log(
          `Successfully undone preparation log ${preparationLogId}`,
        );
        return { status: 'undone', logId: preparationLogId };
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to process undo job: ${message}`);
        throw error;
      });
  }
}
