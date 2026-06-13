import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Decimal } from 'decimal.js';
import { BarInventory } from './entities/bar-inventory.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { UnitConverterService } from '../utils/unit-converter.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AddBarInventoryDto } from './dto/add-bar-inventory.dto';
import { UpdateBarInventoryDto } from './dto/update-bar-inventory.dto';

interface RedisLikeStore {
  client?: {
    scanIterator?: (options: {
      MATCH: string;
      COUNT?: number;
    }) => AsyncIterable<string>;
  };
}

@Injectable()
export class BarInventoryService {
  constructor(
    @InjectRepository(BarInventory)
    private readonly inventoryRepository: Repository<BarInventory>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    private readonly unitConverter: UnitConverterService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private isMassUnit(unit: string): boolean {
    return ['g', 'kg'].includes(unit.toLowerCase());
  }

  private isVolumeUnit(unit: string): boolean {
    return ['ml', 'oz', 'l', 'cl', 'tbsp', 'tsp', 'dash', 'dashes'].includes(
      unit.toLowerCase(),
    );
  }

  private async clearMakeabilityCache() {
    const store = (this.cacheManager as Cache & { store?: RedisLikeStore })
      .store;
    if (store?.client?.scanIterator) {
      for await (const key of store.client.scanIterator({
        MATCH: 'makeability:*',
      })) {
        await this.cacheManager.del(key);
      }
    } else {
      await this.cacheManager.clear();
    }
  }

  async addToInventory(dto: AddBarInventoryDto) {
    const ingredient = await this.ingredientRepository.findOne({
      where: { id: dto.ingredientId },
    });
    if (!ingredient) {
      throw new NotFoundException(`Ingredient ${dto.ingredientId} not found`);
    }

    if (dto.unit) {
      const fromIsMass = this.isMassUnit(dto.unit);
      const fromIsVolume = this.isVolumeUnit(dto.unit);
      const baseIsMass = this.isMassUnit(ingredient.baseUnit);
      const baseIsVolume = this.isVolumeUnit(ingredient.baseUnit);

      if (
        ((fromIsMass && baseIsVolume) || (fromIsVolume && baseIsMass)) &&
        !ingredient.allowMassVolumeConversion
      ) {
        throw new BadRequestException(
          `Ingredient ${ingredient.name} does not allow mass-volume conversions`,
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

    const existing = await this.inventoryRepository.findOne({
      where: { ingredient: { id: dto.ingredientId } },
    });

    if (existing) {
      existing.quantity = existing.quantity.plus(normalizedQuantity);
      if (dto.expirationDate) {
        existing.expirationDate = new Date(dto.expirationDate);
      }
      const result = await this.inventoryRepository.save(existing);
      await this.clearMakeabilityCache();
      return result;
    }

    const newItem = this.inventoryRepository.create({
      ingredient,
      quantity: normalizedQuantity,
      expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null,
    });
    const result = await this.inventoryRepository.save(newItem);
    await this.clearMakeabilityCache();
    return result;
  }

  async getInventory(paginationQuery?: PaginationQueryDto) {
    const page = paginationQuery?.page || 1;
    const limit = paginationQuery?.limit || 20;

    const [items, total] = await this.inventoryRepository.findAndCount({
      relations: ['ingredient'],
      order: { updatedAt: 'DESC' },
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
    const item = await this.inventoryRepository.findOne({
      where: { id },
      relations: ['ingredient'],
    });
    if (!item) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }

    if (dto.unit) {
      const fromIsMass = this.isMassUnit(dto.unit);
      const fromIsVolume = this.isVolumeUnit(dto.unit);
      const baseIsMass = this.isMassUnit(item.ingredient.baseUnit);
      const baseIsVolume = this.isVolumeUnit(item.ingredient.baseUnit);

      if (
        ((fromIsMass && baseIsVolume) || (fromIsVolume && baseIsMass)) &&
        !item.ingredient.allowMassVolumeConversion
      ) {
        throw new BadRequestException(
          `Ingredient ${item.ingredient.name} does not allow mass-volume conversions`,
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
    const result = await this.inventoryRepository.save(item);
    await this.clearMakeabilityCache();
    return result;
  }

  async removeFromInventory(id: string) {
    const item = await this.inventoryRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }
    await this.inventoryRepository.remove(item);
    await this.clearMakeabilityCache();
    return { message: 'Inventory item removed successfully' };
  }

  async bulkAdd(dtos: AddBarInventoryDto[]) {
    return this.dataSource.transaction(async (manager) => {
      const results: BarInventory[] = [];
      for (const dto of dtos) {
        const ingredient = await manager.findOne(Ingredient, {
          where: { id: dto.ingredientId },
        });
        if (!ingredient) {
          throw new NotFoundException(
            `Ingredient ${dto.ingredientId} not found`,
          );
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
        });

        if (existing) {
          existing.quantity = existing.quantity.plus(normalizedQuantity);
          results.push(await manager.save(existing));
        } else {
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
    await this.inventoryRepository.delete(ids);
    await this.clearMakeabilityCache();
    return { message: `${ids.length} inventory items deleted` };
  }
}
