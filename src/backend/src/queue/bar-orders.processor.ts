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

interface PrepareJobPayload {
  type: 'prepare' | 'undo' | 'batch-prepare' | 'batch-undo';
  cocktailId?: string;
  bartenderId: string;
  preparationLogId: string;
  servings?: number;
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

        const cocktail = await transactionalEntityManager.findOne(Cocktail, {
          where: { id: cocktailId },
          relations: ['ingredients'],
        });
        if (!cocktail) {
          preparationLog.status = 'failed_other';
          await transactionalEntityManager.save(preparationLog);
          throw new Error(`Cocktail ${cocktailId} not found`);
        }

        // Lock all inventory rows at once for greedy synonym matching
        const allStock = await transactionalEntityManager
          .createQueryBuilder(BarInventory, 'bi')
          .setLock('pessimistic_write')
          .getMany();

        const deductions: Record<string, unknown>[] = [];

        const remainingStock = new Map(
          allStock.map((row) => [row.id, { row, quantity: row.quantity }]),
        );

        for (const req of cocktail.ingredients) {
          if (!req.ingredient || !req.ingredient.id) {
            preparationLog.status = 'failed_other';
            await transactionalEntityManager.save(preparationLog);
            throw new Error(
              'Cocktail recipe is corrupt: Missing ingredient data.',
            );
          }

          const amountPerServing = this.unitConverter.convert(
            req.amount,
            req.unit,
            req.ingredient.baseUnit,
            req.ingredient,
          );
          const totalAmount = amountPerServing.times(new Decimal(servings));
          const requiredName = req.ingredient.name.toLowerCase().trim();

          // Find eligible inventory rows: direct ID match + synonym matches
          const eligible: Array<{
            rowId: string;
            ingredientName: string;
            quantity: Decimal;
            excess: Decimal;
          }> = [];

          for (const [rowId, entry] of remainingStock) {
            const row = entry.row;
            if (!row.ingredient) continue;

            // Direct ID match
            if (row.ingredient.id === req.ingredient.id) {
              if (entry.quantity.gte(totalAmount)) {
                eligible.push({
                  rowId,
                  ingredientName: row.ingredient.name,
                  quantity: entry.quantity,
                  excess: entry.quantity.minus(totalAmount),
                });
              }
              continue;
            }

            // Synonym match: inventory ingredient name or synonyms match required name
            const rowName = row.ingredient.name.toLowerCase().trim();
            let isSynonym = false;
            if (rowName === requiredName) {
              isSynonym = true;
            } else if (row.ingredient.synonyms) {
              const synNames = row.ingredient.synonyms
                .split(',')
                .map((s) => s.toLowerCase().trim());
              if (synNames.includes(requiredName)) {
                isSynonym = true;
              }
            }

            if (isSynonym && entry.quantity.gte(totalAmount)) {
              eligible.push({
                rowId,
                ingredientName: row.ingredient.name,
                quantity: entry.quantity,
                excess: entry.quantity.minus(totalAmount),
              });
            }
          }

          // Greedy: pick the row with smallest excess (least overflow)
          eligible.sort((a, b) => a.excess.comparedTo(b.excess));

          const bestMatch = eligible[0] || null;

          if (!bestMatch) {
            const isOptional =
              (req as any).is_optional === true ||
              (req as any).type === 'garnish' ||
              (req as any).type === 'rinse';

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
            this.logger.warn(
              `Insufficient stock for ingredient ${req.ingredient.name}: ` +
                `need ${totalAmount}`,
            );
            return {
              status: 'failed_insufficient_stock',
              logId: preparationLogId,
            };
          }

          // Deduct from the best match row
          const result = await transactionalEntityManager
            .createQueryBuilder()
            .update(BarInventory)
            .set({ quantity: () => `quantity - ${totalAmount.toString()}` })
            .where('id = :rowId', { rowId: bestMatch.rowId })
            .andWhere('quantity >= :amount', {
              amount: totalAmount.toString(),
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

          // Update cached quantity for subsequent iterations
          const newQty = bestMatch.quantity.minus(totalAmount);
          remainingStock.set(bestMatch.rowId, {
            row: remainingStock.get(bestMatch.rowId)!.row,
            quantity: newQty,
          });

          deductions.push({
            ingredientId: req.ingredient.id,
            ingredientName: req.ingredient.name,
            amount: totalAmount.toString(),
            unit: req.ingredient.baseUnit,
            actualInventoryRow: bestMatch.ingredientName,
            unitConverted: {
              from: { amount: req.amount.toString(), unit: req.unit },
              to: {
                amount: totalAmount.toString(),
                unit: req.ingredient.baseUnit,
              },
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
      })
      .catch(async (error) => {
        this.logger.error(`Failed to process prepare job: ${error.message}`);

        try {
          await this.preparationLogRepository.update(preparationLogId, {
            status: 'failed_other',
          });
        } catch (updateError) {
          this.logger.error(
            `Failed to update preparation log status: ${updateError}`,
          );
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

        const allDeductions: Record<string, unknown>[] = [];

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

            const amountPerServing = this.unitConverter.convert(
              req.amount,
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
            const isOptional =
              (req as any).is_optional === true ||
              (req as any).type === 'garnish' ||
              (req as any).type === 'rinse';

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
      .catch(async (error) => {
        this.logger.error(`Batch prepare failed: ${error.message}`);
        try {
          await this.preparationLogRepository.update(preparationLogId, {
            status: 'failed_other',
          });
        } catch {}
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

        const barStock = await tx
          .createQueryBuilder(BarInventory, 'bi')
          .setLock('pessimistic_write')
          .where('bi.ingredient_id = :ingredientId', { ingredientId })
          .getOne();

        if (!barStock) {
          this.logger.warn(
            `Cannot restore ingredient ${deduction.ingredientName}: inventory row deleted`,
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

          const barStock = await transactionalEntityManager
            .createQueryBuilder(BarInventory, 'bi')
            .setLock('pessimistic_write')
            .where('bi.ingredient_id = :ingredientId', { ingredientId })
            .getOne();

          if (!barStock) {
            this.logger.warn(
              `Cannot restore ingredient ${deduction.ingredientName}: no inventory row found (possibly deleted)`,
            );
            continue;
          }

          await transactionalEntityManager
            .createQueryBuilder()
            .update(BarInventory)
            .set({ quantity: () => `quantity + ${amount}` })
            .where('ingredient_id = :ingredientId', { ingredientId })
            .execute();

          this.logger.log(
            `Restored ${amount} of ${deduction.ingredientName} (${ingredientId})`,
          );
        }

        preparationLog.undone = true;
        await transactionalEntityManager.save(preparationLog);

        this.logger.log(
          `Successfully undone preparation log ${preparationLogId}`,
        );
        return { status: 'undone', logId: preparationLogId };
      })
      .catch(async (error) => {
        this.logger.error(`Failed to process undo job: ${error.message}`);
        throw error;
      });
  }
}
