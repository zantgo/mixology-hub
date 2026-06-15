jest.mock('./entities/bar-inventory.entity', () => ({
  BarInventory: class BarInventory {},
}));
jest.mock('../ingredients/entities/ingredient.entity', () => ({
  Ingredient: class Ingredient {},
}));

import { NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { BarInventoryService } from './bar-inventory.service';
import { BarInventory } from './entities/bar-inventory.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { UnitConverterService } from '../utils/unit-converter.service';

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: 'ing-1',
    name: 'Vodka',
    baseUnit: 'ml',
    density: new Decimal(1.0),
    allowMassVolumeConversion: true,
    normalizedName: 'VODKA',
    isGlobal: true,
    hierarchyLevel: 0,
    ...overrides,
  } as Ingredient;
}

function makeItem(overrides: Partial<BarInventory> = {}): BarInventory {
  return {
    id: 'inv-1',
    ingredient: makeIngredient(),
    quantity: new Decimal(500),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('BarInventoryService', () => {
  let service: BarInventoryService;
  let repo: any;
  let ingRepo: any;
  let ds: any;
  let cacheInvalidation: any;

  beforeEach(() => {
    const qbMock = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getExists: jest.fn().mockResolvedValue(false),
    };
    repo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      delete: jest.fn(),
    };
    ingRepo = { findOne: jest.fn() };
    ds = {
      transaction: jest
        .fn()
        .mockImplementation(
          async <T>(
            runInTransaction: (manager: any) => Promise<T>,
          ): Promise<T> => {
            const manager = {
              findOne: jest
                .fn()
                .mockImplementation((entityClass: any, options?: any) => {
                  if (entityClass === Ingredient) {
                    if (typeof options === 'string')
                      return ingRepo.findOne({ where: { id: options } });
                    return ingRepo.findOne(options);
                  }
                  if (typeof options === 'string')
                    return repo.findOne({ where: { id: options } });
                  return repo.findOne(options);
                }),
              find: jest.fn(),
              count: jest.fn().mockImplementation(() => {
                return repo.count();
              }),
              create: jest
                .fn()
                .mockImplementation((_entityClass: any, plain: any) => {
                  return repo.create(plain);
                }),
              save: jest.fn().mockImplementation((entity: any) => {
                return repo.save(entity);
              }),
              remove: jest.fn().mockImplementation((entity: any) => {
                return repo.remove(entity);
              }),
              delete: jest
                .fn()
                .mockImplementation((_entityClass: any, ids: any) => {
                  return repo.delete(ids);
                }),
              createQueryBuilder: jest.fn().mockReturnValue(qbMock),
            };
            return runInTransaction(manager);
          },
        ),
    };
    cacheInvalidation = {
      clearByPatterns: jest.fn().mockResolvedValue(undefined),
      clearAll: jest.fn().mockResolvedValue(undefined),
    };
    service = new BarInventoryService(
      repo,
      ingRepo,
      new UnitConverterService(),
      ds,
      cacheInvalidation,
    );
  });

  it('should add a new ingredient to inventory', async () => {
    const ing = makeIngredient();
    ingRepo.findOne.mockResolvedValue(ing);
    repo.findOne.mockResolvedValue(null);
    const newItem = makeItem({ id: 'inv-new', quantity: new Decimal(100) });
    repo.create.mockReturnValue(newItem);
    repo.save.mockResolvedValue(newItem);

    await service.addToInventory({
      ingredientId: 'ing-1',
      quantity: 100,
      unit: 'ml',
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredient: ing,
        quantity: expect.any(Decimal),
      }),
    );
    expect(repo.save).toHaveBeenCalled();
  });

  it('should increment existing inventory item', async () => {
    const ing = makeIngredient();
    const existing = makeItem({ quantity: new Decimal(500) });
    ingRepo.findOne.mockResolvedValue(ing);
    repo.findOne.mockResolvedValue(existing);
    repo.save.mockResolvedValue(existing);

    await service.addToInventory({
      ingredientId: 'ing-1',
      quantity: 100,
      unit: 'ml',
    });
    const saved = (repo.save as jest.Mock).mock.calls[0][0];
    expect(saved.quantity.toNumber()).toBe(600);
  });

  it('should convert units when adding with different unit', async () => {
    const ing = makeIngredient();
    ingRepo.findOne.mockResolvedValue(ing);
    repo.findOne.mockResolvedValue(null);
    const newItem = makeItem();
    repo.create.mockReturnValue(newItem);
    repo.save.mockResolvedValue(newItem);

    await service.addToInventory({
      ingredientId: 'ing-1',
      quantity: 2,
      unit: 'oz',
    });
    const created = (repo.create as jest.Mock).mock.calls[0][0];
    expect(created.quantity.toNumber()).toBeCloseTo(59.14, 1);
  });

  it('should not convert when unit matches baseUnit', async () => {
    const ing = makeIngredient();
    ingRepo.findOne.mockResolvedValue(ing);
    repo.findOne.mockResolvedValue(null);
    const newItem = makeItem();
    repo.create.mockReturnValue(newItem);
    repo.save.mockResolvedValue(newItem);

    await service.addToInventory({
      ingredientId: 'ing-1',
      quantity: 100,
      unit: 'ml',
    });
    const created = (repo.create as jest.Mock).mock.calls[0][0];
    expect(created.quantity.toNumber()).toBe(100);
  });

  it('should throw NotFoundException when ingredient missing', async () => {
    ingRepo.findOne.mockResolvedValue(null);
    await expect(
      service.addToInventory({
        ingredientId: 'nonexistent',
        quantity: 100,
        unit: 'ml',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return paginated inventory', async () => {
    const items = [makeItem(), makeItem({ id: 'inv-2' })];
    repo.findAndCount.mockResolvedValue([items, 2]);
    const result = await service.getInventory({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should use default pagination', async () => {
    repo.findAndCount.mockResolvedValue([[], 0]);
    const result = await service.getInventory();
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('should get inventory item by id', async () => {
    const item = makeItem();
    repo.findOne.mockResolvedValue(item);
    const result = await service.getInventoryItem('inv-1');
    expect(result.id).toBe('inv-1');
  });

  it('should throw NotFoundException when item not found', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.getInventoryItem('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should update inventory item quantity', async () => {
    const item = makeItem();
    repo.findOne.mockResolvedValue(item);
    repo.save.mockResolvedValue(item);
    await service.updateInventoryItem('inv-1', { quantity: 200, unit: 'ml' });
    const saved = (repo.save as jest.Mock).mock.calls[0][0];
    expect(saved.quantity.toNumber()).toBe(200);
  });

  it('should convert units when updating', async () => {
    const item = makeItem();
    repo.findOne.mockResolvedValue(item);
    repo.save.mockResolvedValue(item);
    await service.updateInventoryItem('inv-1', { quantity: 1, unit: 'oz' });
    const saved = (repo.save as jest.Mock).mock.calls[0][0];
    expect(saved.quantity.toNumber()).toBeCloseTo(29.57, 1);
  });

  it('should throw when updating nonexistent item', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.updateInventoryItem('nonexistent', { quantity: 100, unit: 'ml' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should remove inventory item', async () => {
    const item = makeItem();
    repo.findOne.mockResolvedValue(item);
    repo.remove.mockResolvedValue(item);
    const result = await service.removeFromInventory('inv-1');
    expect(result.message).toBe('Inventory item removed successfully');
  });

  it('should throw when removing nonexistent item', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.removeFromInventory('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw UnprocessableEntityException when inventory limit reached', async () => {
    const ing = makeIngredient();
    ingRepo.findOne.mockResolvedValue(ing);
    repo.findOne.mockResolvedValue(null);
    repo.count.mockResolvedValue(10000);

    await expect(
      service.addToInventory({
        ingredientId: 'ing-1',
        quantity: 100,
        unit: 'ml',
      }),
    ).rejects.toThrow('Maximum inventory limit reached');
  });

  it('should not check limit when updating existing inventory item', async () => {
    const ing = makeIngredient();
    const existing = makeItem({ quantity: new Decimal(500) });
    ingRepo.findOne.mockResolvedValue(ing);
    repo.findOne.mockResolvedValue(existing);
    repo.save.mockResolvedValue(existing);

    await service.addToInventory({
      ingredientId: 'ing-1',
      quantity: 100,
      unit: 'ml',
    });

    expect(repo.count).not.toHaveBeenCalled();
  });

  it('should bulk add items in transaction', async () => {
    const ing = makeIngredient();
    ds.transaction.mockImplementation((cb) => {
      let callCount = 0;
      const mgr = {
        findOne: jest.fn().mockImplementation(() => {
          callCount++;
          return callCount === 1 ? Promise.resolve(ing) : Promise.resolve(null);
        }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockReturnValue(makeItem()),
        save: jest.fn().mockResolvedValue(makeItem()),
      };
      return cb(mgr);
    });
    const result = await service.bulkAdd([
      { ingredientId: 'ing-1', quantity: 100, unit: 'ml' },
    ]);
    expect(result).toHaveLength(1);
  });

  it('should throw on missing ingredient in bulk add', async () => {
    ds.transaction.mockImplementation((cb) => {
      const mgr = { findOne: jest.fn().mockResolvedValue(null) };
      return cb(mgr);
    });
    await expect(
      service.bulkAdd([
        { ingredientId: 'nonexistent', quantity: 100, unit: 'ml' },
      ]),
    ).rejects.toThrow(NotFoundException);
  });

  it('should increment existing in bulk add', async () => {
    const ing = makeIngredient();
    const existing = makeItem({ quantity: new Decimal(100) });
    ds.transaction.mockImplementation((cb) => {
      let callCount = 0;
      const mgr = {
        findOne: jest.fn().mockImplementation(() => {
          callCount++;
          return callCount === 1
            ? Promise.resolve(ing)
            : Promise.resolve(existing);
        }),
        count: jest.fn().mockResolvedValue(0),
        save: jest.fn().mockResolvedValue(existing),
      };
      return cb(mgr);
    });
    const result = await service.bulkAdd([
      { ingredientId: 'ing-1', quantity: 50, unit: 'ml' },
    ]);
    expect(result).toHaveLength(1);
  });

  it('should throw inventory limit error in bulk add', async () => {
    const ing = makeIngredient();
    ds.transaction.mockImplementation((cb) => {
      let callCount = 0;
      const mgr = {
        findOne: jest.fn().mockImplementation(() => {
          callCount++;
          return callCount === 1 ? Promise.resolve(ing) : Promise.resolve(null);
        }),
        count: jest.fn().mockResolvedValue(10000),
        create: jest.fn().mockReturnValue(makeItem()),
        save: jest.fn().mockResolvedValue(makeItem()),
      };
      return cb(mgr);
    });
    await expect(
      service.bulkAdd([{ ingredientId: 'ing-1', quantity: 100, unit: 'ml' }]),
    ).rejects.toThrow('Maximum inventory limit reached');
  });

  it('should bulk delete items', async () => {
    repo.delete.mockResolvedValue({ affected: 2 });
    const result = await service.bulkDelete(['inv-1', 'inv-2']);
    expect(result.message).toBe('2 inventory items deleted');
  });
});
