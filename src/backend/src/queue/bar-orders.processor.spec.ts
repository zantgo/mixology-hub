jest.mock('../inventory/entities/bar-inventory.entity', () => ({
  BarInventory: class BarInventory {},
}));
jest.mock('../cocktails/entities/cocktail.entity', () => ({
  Cocktail: class Cocktail {},
}));
jest.mock('../cocktails/entities/cocktail-ingredient.entity', () => ({
  CocktailIngredient: class CocktailIngredient {},
}));
jest.mock('../cocktails/entities/preparation-log.entity', () => ({
  PreparationLog: class PreparationLog {},
}));
jest.mock('../ingredients/entities/ingredient.entity', () => ({
  Ingredient: class Ingredient {},
}));

import { Job } from 'bullmq';
import { Decimal } from 'decimal.js';
import { DataSource, Repository } from 'typeorm';
import {
  BarOrdersProcessor,
  type PrepareJobPayload,
} from './bar-orders.processor';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { PreparationLog } from '../cocktails/entities/preparation-log.entity';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { UnitConverterService } from '../utils/unit-converter.service';
import { Ingredient } from '../ingredients/entities/ingredient.entity';

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: 'ing-1',
    name: 'Vodka',
    baseUnit: 'ml',
    density: new Decimal(1.0),
    allowMassVolumeConversion: true,
    ...overrides,
  } as Ingredient;
}

function makeCocktailIngredient(overrides: any = {}): CocktailIngredient {
  return {
    amount: 50,
    unit: 'ml',
    ingredient: makeIngredient(),
    ...overrides,
  } as CocktailIngredient;
}

function makeCocktail(overrides: any = {}): Cocktail {
  return {
    id: 'cocktail-1',
    name: 'Test Cocktail',
    ingredients: [makeCocktailIngredient()],
    ...overrides,
  } as Cocktail;
}

function makeLog(overrides: any = {}): PreparationLog {
  return {
    id: 'log-1',
    status: 'queued',
    undone: false,
    ...overrides,
  } as PreparationLog;
}

function makeJob(
  overrides: Partial<PrepareJobPayload> = {},
): Job<PrepareJobPayload> {
  return {
    id: 'job-1',
    data: {
      cocktailId: 'cocktail-1',
      bartenderId: 'user-1',
      preparationLogId: 'log-1',
      servings: 1,
      force: false,
      ...overrides,
    },
  } as Job<PrepareJobPayload>;
}

function createMocks() {
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    execute: jest.fn(),
    set: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  };
  const tm = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    query: jest.fn().mockImplementation((_sql: string, params: string[]) =>
      Promise.resolve([
        {
          id: params[0],
          name: params[0] === 'ing-1' ? 'Vodka' : 'Unknown',
          synonyms: null,
        },
      ]),
    ),
  };
  const ds = {
    transaction: jest
      .fn()
      .mockImplementation(
        async (
          cb: (manager: typeof tm) => Promise<unknown>,
        ): Promise<unknown> => cb(tm),
      ),
  };
  const prepRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
  const processor = new BarOrdersProcessor(
    ds as unknown as DataSource,
    {} as unknown as Repository<BarInventory>,
    {} as unknown as Repository<Cocktail>,
    prepRepo as unknown as Repository<PreparationLog>,
    new UnitConverterService(),
  );
  return { qb, tm, ds, prepRepo, processor };
}

describe('BarOrdersProcessor - prepare', () => {
  it('should successfully prepare a cocktail with sufficient stock', async () => {
    const { qb, tm, processor } = createMocks();
    const log = makeLog();
    const cocktail = makeCocktail();
    const job = makeJob();

    tm.findOne
      .mockResolvedValueOnce(log)
      .mockResolvedValueOnce(cocktail)
      .mockResolvedValueOnce(log);
    qb.getMany.mockResolvedValue([
      {
        id: 'stock-1',
        quantity: new Decimal(100),
        ingredient: { id: 'ing-1', name: 'Vodka' },
      },
    ]);
    qb.execute.mockResolvedValue({ affected: 1 });

    const result = await processor.process(job);
    expect(result.status).toBe('completed');
    expect(result.logId).toBe('log-1');
    const lastSave = (
      tm.save.mock.calls.at(-1) as [PreparationLog] | undefined
    )?.[0];
    expect(lastSave.status).toBe('completed');
    expect(lastSave.deductedIngredients).toHaveLength(1);
  });

  it('should fail with insufficient stock', async () => {
    const { qb, tm, processor } = createMocks();
    tm.findOne.mockResolvedValueOnce(makeLog()).mockResolvedValueOnce(
      makeCocktail({
        ingredients: [makeCocktailIngredient({ amount: 500, unit: 'ml' })],
      }),
    );
    qb.getMany.mockResolvedValue([
      {
        id: 'stock-1',
        quantity: new Decimal(10),
        ingredient: { id: 'ing-1', name: 'Vodka' },
      },
    ]);

    const result = await processor.process(makeJob());
    expect(result.status).toBe('failed_insufficient_stock');
  });

  it('should skip ingredients in force mode', async () => {
    const { qb, tm, processor } = createMocks();
    const ing1 = makeIngredient({ id: 'ing-1', name: 'Vodka' });
    const ing2 = makeIngredient({ id: 'ing-2', name: 'Lime Juice' });
    const cocktail = makeCocktail({
      ingredients: [
        makeCocktailIngredient({ amount: 500, unit: 'ml', ingredient: ing1 }),
        makeCocktailIngredient({ amount: 30, unit: 'ml', ingredient: ing2 }),
      ],
    });
    tm.findOne
      .mockResolvedValueOnce(makeLog())
      .mockResolvedValueOnce(cocktail)
      .mockResolvedValueOnce(makeLog());
    qb.getMany.mockResolvedValue([
      {
        id: 'stock-1',
        quantity: new Decimal(10),
        ingredient: { id: 'ing-1', name: 'Vodka' },
      },
      {
        id: 'stock-2',
        quantity: new Decimal(100),
        ingredient: { id: 'ing-2', name: 'Lime Juice' },
      },
    ]);
    qb.execute.mockResolvedValue({ affected: 1 });

    const result = await processor.process(makeJob({ force: true }));
    expect(result.status).toBe('completed');
    const lastSave = (
      tm.save.mock.calls.at(-1) as [PreparationLog] | undefined
    )?.[0];
    expect(lastSave.deductedIngredients).toHaveLength(2);
    expect(
      (lastSave.deductedIngredients?.[0] as Record<string, unknown>)?.skipped,
    ).toBe(true);
  });

  it('should throw when log not found', async () => {
    const { tm, processor } = createMocks();
    tm.findOne.mockResolvedValue(null);
    await expect(processor.process(makeJob())).rejects.toThrow(
      'PreparationLog log-1 not found',
    );
  });

  it('should throw when cocktail not found', async () => {
    const { tm, prepRepo, processor } = createMocks();
    tm.findOne.mockResolvedValueOnce(makeLog()).mockResolvedValueOnce(null);
    await expect(processor.process(makeJob())).rejects.toThrow(
      'Cocktail cocktail-1 not found',
    );
    expect(prepRepo.update).toHaveBeenCalledWith('log-1', {
      status: 'failed_other',
    });
  });

  it('should throw when recipe is corrupt', async () => {
    const { qb, tm, processor } = createMocks();
    tm.findOne.mockResolvedValueOnce(makeLog()).mockResolvedValueOnce(
      makeCocktail({
        ingredients: [{ amount: 50, unit: 'ml', ingredient: null }],
      }),
    );
    qb.getMany.mockResolvedValue([]);
    await expect(processor.process(makeJob())).rejects.toThrow(
      'Cocktail recipe is corrupt',
    );
  });

  it('should fail when update returns 0 rows', async () => {
    const { qb, tm, prepRepo, processor } = createMocks();
    tm.findOne
      .mockResolvedValueOnce(makeLog())
      .mockResolvedValueOnce(makeCocktail())
      .mockResolvedValueOnce(makeLog());
    qb.getMany.mockResolvedValue([
      {
        id: 'stock-1',
        quantity: new Decimal(100),
        ingredient: { id: 'ing-1', name: 'Vodka' },
      },
    ]);
    qb.execute.mockResolvedValue({ affected: 0 });

    const result = await processor.process(makeJob());
    expect(result.status).toBe('failed_insufficient_stock');
    expect(prepRepo.update).toHaveBeenCalledWith('log-1', {
      status: 'failed_insufficient_stock',
    });
  });

  it('should rollback prior deductions when later ingredient fails', async () => {
    const { qb, tm, prepRepo, processor } = createMocks();
    const ing1 = makeIngredient({ id: 'ing-1', name: 'Vodka' });
    const ing2 = makeIngredient({ id: 'ing-2', name: 'Lime Juice' });
    const cocktail = makeCocktail({
      ingredients: [
        makeCocktailIngredient({ amount: 50, unit: 'ml', ingredient: ing1 }),
        makeCocktailIngredient({ amount: 30, unit: 'ml', ingredient: ing2 }),
      ],
    });
    tm.findOne
      .mockResolvedValueOnce(makeLog())
      .mockResolvedValueOnce(cocktail)
      .mockResolvedValueOnce(makeLog());
    qb.getMany.mockResolvedValue([
      {
        id: 'stock-1',
        quantity: new Decimal(100),
        ingredient: { id: 'ing-1', name: 'Vodka' },
      },
      {
        id: 'stock-2',
        quantity: new Decimal(100),
        ingredient: { id: 'ing-2', name: 'Lime Juice' },
      },
    ]);
    // First ingredient deduction succeeds, second fails at execute stage
    qb.execute
      .mockResolvedValueOnce({ affected: 1 })
      .mockResolvedValueOnce({ affected: 0 });

    const result = await processor.process(makeJob());
    expect(result.status).toBe('failed_insufficient_stock');
    // Verify log was updated to insufficient_stock externally (rollback occurred)
    expect(prepRepo.update).toHaveBeenCalledWith('log-1', {
      status: 'failed_insufficient_stock',
    });
    // Both ingredients were attempted (execute called twice)
    expect(qb.execute).toHaveBeenCalledTimes(2);
  });

  it('should convert units during preparation', async () => {
    const { qb, tm, processor } = createMocks();
    const ing = makeIngredient({ baseUnit: 'ml' });
    tm.findOne
      .mockResolvedValueOnce(makeLog())
      .mockResolvedValueOnce(
        makeCocktail({
          ingredients: [
            makeCocktailIngredient({ amount: 2, unit: 'oz', ingredient: ing }),
          ],
        }),
      )
      .mockResolvedValueOnce(makeLog());
    qb.getMany.mockResolvedValue([
      { id: 'stock-1', quantity: new Decimal(100), ingredient: ing },
    ]);
    qb.execute.mockResolvedValue({ affected: 1 });

    await processor.process(makeJob());
    expect((qb.set.mock.calls[0] as unknown[])[0]).toBeDefined();
  });

  it('should multiply by servings', async () => {
    const { qb, tm, processor } = createMocks();
    const ing = makeIngredient({ baseUnit: 'ml' });
    tm.findOne
      .mockResolvedValueOnce(makeLog())
      .mockResolvedValueOnce(
        makeCocktail({
          ingredients: [
            makeCocktailIngredient({ amount: 50, unit: 'ml', ingredient: ing }),
          ],
        }),
      )
      .mockResolvedValueOnce(makeLog());
    qb.getMany.mockResolvedValue([
      { id: 'stock-1', quantity: new Decimal(200), ingredient: ing },
    ]);
    qb.execute.mockResolvedValue({ affected: 1 });

    await processor.process(makeJob({ servings: 3 }));
    expect((qb.set.mock.calls[0] as unknown[])[0]).toBeDefined();
  });

  it('should skip job when preparation was cancelled before processing', async () => {
    const { tm, processor } = createMocks();
    const log = makeLog({ status: 'cancelled' });
    tm.findOne.mockResolvedValueOnce(log);

    const result = await processor.process(makeJob());
    expect(result.status).toBe('cancelled');
    expect(result.logId).toBe('log-1');
  });

  it('should cancel mid-flight when re-check catches cancelled status', async () => {
    const { qb, tm, processor } = createMocks();
    const evaluatingLog = makeLog({ status: 'evaluating' });
    const cancelledLog = makeLog({ status: 'cancelled' });
    const cocktail = makeCocktail();
    tm.findOne
      .mockResolvedValueOnce(evaluatingLog)
      .mockResolvedValueOnce(cocktail)
      .mockResolvedValueOnce(cancelledLog);
    qb.getMany.mockResolvedValue([
      {
        id: 'stock-1',
        quantity: new Decimal(100),
        ingredient: { id: 'ing-1', name: 'Vodka' },
      },
    ]);

    const result = await processor.process(makeJob());
    expect(result.status).toBe('cancelled');
    expect(result.logId).toBe('log-1');
  });
});

describe('BarOrdersProcessor - undo', () => {
  it('should successfully undo a completed preparation', async () => {
    const { qb, tm, processor } = createMocks();
    const log = makeLog({
      status: 'completed',
      deductedIngredients: [
        {
          ingredientId: 'ing-1',
          ingredientName: 'Vodka',
          amount: '50',
          unit: 'ml',
        },
        {
          ingredientId: 'ing-2',
          ingredientName: 'Lime Juice',
          amount: '30',
          unit: 'ml',
        },
      ],
    });
    tm.findOne.mockResolvedValue(log);
    qb.getOne.mockResolvedValue({ quantity: new Decimal(100) });
    qb.execute.mockResolvedValue({ affected: 1 });

    const result = await processor.process(makeJob({ type: 'undo' }));
    expect(result.status).toBe('undone');
    expect(qb.set.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(
      (qb.set.mock.calls[0] as Record<string, unknown>[])[0].quantity,
    ).toBeDefined();
    expect(tm.save).toHaveBeenCalled();
  });

  it('should skip ingredients that were skipped in force prepare', async () => {
    const { qb, tm, processor } = createMocks();
    const log = makeLog({
      status: 'completed',
      deductedIngredients: [
        {
          ingredientId: 'ing-1',
          ingredientName: 'Vodka',
          amount: '0',
          skipped: true,
        },
        {
          ingredientId: 'ing-2',
          ingredientName: 'Lime Juice',
          amount: '30',
          unit: 'ml',
        },
      ],
    });
    tm.findOne.mockResolvedValue(log);
    qb.getOne.mockResolvedValue({ quantity: new Decimal(100) });
    qb.execute.mockResolvedValue({ affected: 1 });

    const result = await processor.process(makeJob({ type: 'undo' }));
    expect(result.status).toBe('undone');
    expect(qb.set.mock.calls.length).toBe(1);
  });

  it('should gracefully skip deleted inventory rows', async () => {
    const { qb, tm, processor } = createMocks();
    const log = makeLog({
      status: 'completed',
      deductedIngredients: [
        {
          ingredientId: 'ing-1',
          ingredientName: 'Deleted',
          amount: '50',
          unit: 'ml',
        },
      ],
    });
    tm.findOne.mockResolvedValue(log);
    qb.getOne.mockResolvedValue(null);

    const result = await processor.process(makeJob({ type: 'undo' }));
    expect(result.status).toBe('undone');
    expect(tm.save).toHaveBeenCalled();
  });

  it('should throw when log not found', async () => {
    const { tm, processor } = createMocks();
    tm.findOne.mockResolvedValue(null);
    await expect(processor.process(makeJob({ type: 'undo' }))).rejects.toThrow(
      'PreparationLog log-1 not found',
    );
  });

  it('should throw when log is not completed', async () => {
    const { tm, processor } = createMocks();
    tm.findOne.mockResolvedValue(makeLog({ status: 'queued' }));
    await expect(processor.process(makeJob({ type: 'undo' }))).rejects.toThrow(
      'status is queued',
    );
  });

  it('should throw when already undone', async () => {
    const { tm, processor } = createMocks();
    tm.findOne.mockResolvedValue(
      makeLog({ status: 'completed', undone: true }),
    );
    await expect(processor.process(makeJob({ type: 'undo' }))).rejects.toThrow(
      'already been undone',
    );
  });

  it('should throw when no deductions', async () => {
    const { tm, processor } = createMocks();
    tm.findOne.mockResolvedValue(
      makeLog({ status: 'completed', deductedIngredients: [] }),
    );
    await expect(processor.process(makeJob({ type: 'undo' }))).rejects.toThrow(
      'No deductions found',
    );
  });
});
