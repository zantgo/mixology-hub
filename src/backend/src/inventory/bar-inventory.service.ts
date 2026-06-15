import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Decimal } from 'decimal.js';
import { BarInventory } from './entities/bar-inventory.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { UnitConverterService } from '../utils/unit-converter.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AddBarInventoryDto } from './dto/add-bar-inventory.dto';
import { UpdateBarInventoryDto } from './dto/update-bar-inventory.dto';
import { CacheInvalidationService } from '../redis-cache/cache-invalidation.service';
import { PreparationLog } from '../cocktails/entities/preparation-log.entity';

@Injectable()
export class BarInventoryService {
  constructor(
    @InjectRepository(BarInventory)
    private readonly inventoryRepository: Repository<BarInventory>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    private readonly unitConverter: UnitConverterService,
    private readonly dataSource: DataSource,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  private async clearMakeabilityCache() {
    await this.cacheInvalidation.clearByPatterns(['makeability:*', 'search:*']);
  }

  async addToInventory(dto: AddBarInventoryDto) {
    return this.dataSource.transaction(async (manager) => {
      const ingredient = await manager.findOne(Ingredient, {
        where: { id: dto.ingredientId },
      });
      if (!ingredient) {
        throw new NotFoundException(`Ingredient ${dto.ingredientId} not found`);
      }

      if (dto.unit) {
        if (
          !this.unitConverter.canConvertBetween(
            dto.unit,
            ingredient.baseUnit,
            ingredient,
          )
        ) {
          throw new BadRequestException(
            `Incompatible unit type: Ingredient "${ingredient.name}" expects unit compatible with base unit "${ingredient.baseUnit}".`,
          );
        }
      }

      let normalizedQuantity = new Decimal(dto.quantity);
      if (dto.unit && dto.unit !== ingredient.baseUnit) {
        normalizedQuantity = this.unitConverter.convert(
          normalizedQuantity,
          dto.unit,
          ingredient.baseUnit,
          ingredient,
        );
      }

      const existing = await manager.findOne(BarInventory, {
        where: { ingredient: { id: dto.ingredientId } },
        lock: { mode: 'pessimistic_write' },
      });

      if (existing) {
        existing.quantity = existing.quantity.plus(normalizedQuantity);
        if (dto.expirationDate) {
          existing.expirationDate = new Date(dto.expirationDate);
        }
        const result = await manager.save(existing);
        await this.clearMakeabilityCache();
        return result;
      }

      const currentCount = await manager.count(BarInventory);
      if (currentCount >= 10000) {
        throw new UnprocessableEntityException(
          'Maximum inventory limit reached (10,000 distinct ingredients). Please consider removing unused items.',
        );
      }

      const newItem = manager.create(BarInventory, {
        ingredient,
        quantity: normalizedQuantity,
        expirationDate: dto.expirationDate
          ? new Date(dto.expirationDate)
          : null,
      });
      const result = await manager.save(newItem);
      await this.clearMakeabilityCache();
      return result;
    });
  }

  async getInventory(paginationQuery?: PaginationQueryDto) {
    const page = paginationQuery?.page || 1;
    const limit = paginationQuery?.limit || 20;

    const [items, total] = await this.inventoryRepository.findAndCount({
      relations: ['ingredient'],
      order: { updatedAt: 'DESC' },
      // eslint-disable-next-line no-restricted-syntax
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data: items, total, page, limit };
  }

  async getInventoryItem(id: string) {
    const item = await this.inventoryRepository.findOne({
      where: { id },
      relations: ['ingredient'],
    });
    if (!item) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }
    return item;
  }

  async updateInventoryItem(id: string, dto: UpdateBarInventoryDto) {
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(BarInventory, {
        where: { id },
        relations: ['ingredient'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) {
        throw new NotFoundException(`Inventory item ${id} not found`);
      }

      if (dto.unit) {
        if (
          !this.unitConverter.canConvertBetween(
            dto.unit,
            item.ingredient.baseUnit,
            item.ingredient,
          )
        ) {
          throw new BadRequestException(
            `Incompatible unit type: Ingredient "${item.ingredient.name}" expects unit compatible with base unit "${item.ingredient.baseUnit}".`,
          );
        }
      }

      let normalizedQuantity = new Decimal(dto.quantity);
      if (dto.unit && dto.unit !== item.ingredient.baseUnit) {
        normalizedQuantity = this.unitConverter.convert(
          normalizedQuantity,
          dto.unit,
          item.ingredient.baseUnit,
          item.ingredient,
        );
      }

      item.quantity = normalizedQuantity;
      if (dto.expirationDate !== undefined) {
        item.expirationDate = dto.expirationDate
          ? new Date(dto.expirationDate)
          : null;
      }
      const result = await manager.save(item);
      await this.clearMakeabilityCache();
      return result;
    });
  }

  async removeFromInventory(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(BarInventory, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) {
        throw new NotFoundException(`Inventory item ${id} not found`);
      }

      // eslint-disable-next-line no-restricted-syntax
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const hasRecentUse = await manager
        .createQueryBuilder(PreparationLog, 'log')
        .where('log.status = :status', { status: 'completed' })
        .andWhere('log.undone = false')
        .andWhere('log.createdAt > :cutoff', { cutoff: fifteenMinutesAgo })
        .andWhere('log.deductedIngredients @> :pattern', {
          pattern: JSON.stringify([{ ingredientId: item.ingredient.id }]),
        })
        .getExists();

      if (hasRecentUse) {
        throw new ConflictException(
          `Cannot delete inventory item "${item.ingredient.name}": it was used in a preparation within the last 15 minutes.`,
        );
      }

      await manager.remove(item);
      await this.clearMakeabilityCache();
      return { message: 'Inventory item removed successfully' };
    });
  }

  async bulkAdd(dtos: AddBarInventoryDto[]) {
    return this.dataSource.transaction(async (manager) => {
      const sortedDtos = [...dtos].sort((a, b) =>
        a.ingredientId.localeCompare(b.ingredientId),
      );
      const results: BarInventory[] = [];
      for (const dto of sortedDtos) {
        const ingredient = await manager.findOne(Ingredient, {
          where: { id: dto.ingredientId },
        });
        if (!ingredient) {
          throw new NotFoundException(
            `Ingredient ${dto.ingredientId} not found`,
          );
        }

        if (dto.unit) {
          if (
            !this.unitConverter.canConvertBetween(
              dto.unit,
              ingredient.baseUnit,
              ingredient,
            )
          ) {
            throw new BadRequestException(
              `Incompatible unit type: Ingredient "${ingredient.name}" expects unit compatible with base unit "${ingredient.baseUnit}".`,
            );
          }
        }

        let normalizedQuantity = new Decimal(dto.quantity);
        if (dto.unit && dto.unit !== ingredient.baseUnit) {
          normalizedQuantity = this.unitConverter.convert(
            normalizedQuantity,
            dto.unit,
            ingredient.baseUnit,
            ingredient,
          );
        }

        const existing = await manager.findOne(BarInventory, {
          where: { ingredient: { id: dto.ingredientId } },
          lock: { mode: 'pessimistic_write' },
        });

        if (existing) {
          existing.quantity = existing.quantity.plus(normalizedQuantity);
          results.push(await manager.save(existing));
        } else {
          const currentCount = await manager.count(BarInventory);
          if (currentCount >= 10000) {
            throw new UnprocessableEntityException(
              'Maximum inventory limit reached (10,000 distinct ingredients). Please consider removing unused items.',
            );
          }

          const newItem = manager.create(BarInventory, {
            ingredient,
            quantity: normalizedQuantity,
            expirationDate: dto.expirationDate
              ? new Date(dto.expirationDate)
              : null,
          });
          results.push(await manager.save(newItem));
        }
      }
      await this.clearMakeabilityCache();
      return results;
    });
  }

  async bulkDelete(ids: string[]) {
    return this.dataSource.transaction(async (manager) => {
      // eslint-disable-next-line no-restricted-syntax
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      const recentLog = await manager
        .createQueryBuilder(PreparationLog, 'log')
        .where('log.status = :status', { status: 'completed' })
        .andWhere('log.undone = false')
        .andWhere('log.createdAt > :cutoff', { cutoff: fifteenMinutesAgo })
        .andWhere(
          `EXISTS (
             SELECT 1 FROM jsonb_array_elements(COALESCE(log.deductedIngredients, '[]'::jsonb)) AS e
             WHERE e->>'ingredientId' IN (
               SELECT bi.ingredient_id FROM bar_inventory bi WHERE bi.id = ANY(:ids)
             )
           )`,
          { ids },
        )
        .limit(1)
        .getOne();

      if (recentLog) {
        throw new ConflictException(
          'Cannot delete inventory items: one or more were used in a preparation within the last 15 minutes.',
        );
      }

      await manager.delete(BarInventory, ids);
      await this.clearMakeabilityCache();
      return { message: `${ids.length} inventory items deleted` };
    });
  }
}
