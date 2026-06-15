import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { Decimal } from 'decimal.js';
import * as path from 'path';
import { Job } from 'bullmq';
import { BarOrdersProcessor, PrepareJobPayload } from './bar-orders.processor';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { PreparationLog } from '../cocktails/entities/preparation-log.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';
import { UnitConverterService } from '../utils/unit-converter.service';

describe('BarOrdersProcessor (integration)', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let processor: BarOrdersProcessor;
  let ingredientRepo: Repository<Ingredient>;
  let inventoryRepo: Repository<BarInventory>;
  let cocktailRepo: Repository<Cocktail>;
  let cocktailIngredientRepo: Repository<CocktailIngredient>;
  let logRepo: Repository<PreparationLog>;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: ['.env', '../../.env'],
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            type: 'postgres',
            host: config.get<string>('DB_HOST', 'localhost'),
            port: config.get<number>('DB_PORT', 5432),
            username: config.get<string>('DB_USER', 'postgres'),
            password: config.get<string>('DB_PASSWORD', 'postgres'),
            database: config.get<string>('DB_NAME', 'mixology_db'),
            entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],
            synchronize: true,
          }),
        }),
      ],
      providers: [BarOrdersProcessor, UnitConverterService],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
    processor = module.get<BarOrdersProcessor>(BarOrdersProcessor);
    ingredientRepo = dataSource.getRepository(Ingredient);
    inventoryRepo = dataSource.getRepository(BarInventory);
    cocktailRepo = dataSource.getRepository(Cocktail);
    cocktailIngredientRepo = dataSource.getRepository(CocktailIngredient);
    logRepo = dataSource.getRepository(PreparationLog);
    userRepo = dataSource.getRepository(User);
  }, 30000);

  afterAll(async () => {
    if (module) await module.close();
  });

  beforeEach(async () => {
    // Clean all tables in proper order (respecting foreign keys)
    await dataSource.query('DELETE FROM cocktail_ingredients');
    await dataSource.query('DELETE FROM preparation_logs');
    await dataSource.query('DELETE FROM bar_inventory');
    await dataSource.query('DELETE FROM cocktails');
    await dataSource.query('DELETE FROM ingredients');
    await dataSource.query('DELETE FROM users');
  });

  function makeUser(overrides: Partial<User> = {}): Promise<User> {
    const user = userRepo.create({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: '$2b$10$test',
      displayName: 'Test User',
      ...overrides,
    });
    return userRepo.save(user);
  }

  function makeIngredient(
    overrides: Partial<Ingredient> = {},
  ): Promise<Ingredient> {
    const ingredient = ingredientRepo.create({
      id: `ing-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: 'Vodka',
      baseUnit: 'ml',
      density: new Decimal(1.0),
      allowMassVolumeConversion: true,
      normalizedName: 'VODKA',
      ...overrides,
    });
    return ingredientRepo.save(ingredient);
  }

  function makeInventory(
    ingredient: Ingredient,
    quantity: Decimal | number,
  ): Promise<BarInventory> {
    const item = inventoryRepo.create({
      ingredient,
      quantity: new Decimal(quantity),
    });
    return inventoryRepo.save(item);
  }

  async function makeCocktailAndLog(
    ingredients: Array<{
      ingredient: Ingredient;
      amount: number;
      unit: string;
    }>,
    overrides: Partial<PreparationLog> = {},
  ): Promise<{
    cocktail: Cocktail;
    log: PreparationLog;
  }> {
    const cocktail = cocktailRepo.create({
      id: `cocktail-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: 'Test Cocktail',
      isPublic: true,
    });
    const savedCocktail = await cocktailRepo.save(cocktail);

    for (const ci of ingredients) {
      const cocktailIngredient = cocktailIngredientRepo.create({
        cocktail: savedCocktail,
        ingredient: ci.ingredient,
        amount: ci.amount,
        unit: ci.unit,
      });
      await cocktailIngredientRepo.save(cocktailIngredient);
    }

    const log = logRepo.create({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      bartenderId: 'user-1',
      cocktailId: savedCocktail.id,
      cocktailNameSnapshot: savedCocktail.name,
      servings: 1,
      status: 'queued',
      ...overrides,
    });
    const savedLog = await logRepo.save(log);

    return { cocktail: savedCocktail, log: savedLog };
  }

  function makeJob(data: Partial<PrepareJobPayload>): Job<PrepareJobPayload> {
    return {
      id: `job-${Date.now()}`,
      data: {
        type: 'prepare',
        bartenderId: 'user-1',
        preparationLogId: 'log-1',
        servings: 1,
        force: false,
        ...data,
      },
    } as Job<PrepareJobPayload>;
  }

  it('should prepare a cocktail and deduct inventory', async () => {
    await makeUser();
    const ingredient = await makeIngredient({ name: 'Vodka', baseUnit: 'ml' });
    await makeInventory(ingredient, 100);
    const { cocktail, log } = await makeCocktailAndLog([
      { ingredient, amount: 50, unit: 'ml' },
    ]);

    const job = makeJob({
      cocktailId: cocktail.id,
      preparationLogId: log.id,
    });
    const result = await processor.process(job);

    expect(result.status).toBe('completed');

    const updatedLog = await logRepo.findOne({ where: { id: log.id } });
    expect(updatedLog?.status).toBe('completed');
    expect(updatedLog?.deductedIngredients).toHaveLength(1);

    const stock = await inventoryRepo.findOne({
      where: { ingredient: { id: ingredient.id } },
      relations: ['ingredient'],
    });
    expect(stock?.quantity.toString()).toBe('50');
  });

  it('should handle incompatible unit conversion gracefully (qualitative unit)', async () => {
    await makeUser();
    const ingredient = await makeIngredient({
      name: 'Simple Syrup',
      baseUnit: 'ml',
    });
    await makeInventory(ingredient, 500);

    const { cocktail, log } = await makeCocktailAndLog([
      { ingredient, amount: 1, unit: 'count' },
    ]);

    const job = makeJob({
      cocktailId: cocktail.id,
      preparationLogId: log.id,
    });
    const result = await processor.process(job);

    expect(result.status).toBe('completed');

    const updatedLog = await logRepo.findOne({ where: { id: log.id } });
    const deduction = updatedLog?.deductedIngredients?.[0];
    expect(deduction?.skipped).toBe(true);
    expect(deduction?.deducted).toBe('0');
  });

  it('should successfully undo a preparation and restore inventory', async () => {
    await makeUser();
    const ingredient = await makeIngredient({ name: 'Vodka', baseUnit: 'ml' });
    await makeInventory(ingredient, 100);
    const { cocktail, log } = await makeCocktailAndLog([
      { ingredient, amount: 50, unit: 'ml' },
    ]);

    const prepareJob = makeJob({
      type: 'prepare',
      cocktailId: cocktail.id,
      preparationLogId: log.id,
    });
    const prepareResult = await processor.process(prepareJob);
    expect(prepareResult.status).toBe('completed');

    let stock = await inventoryRepo.findOne({
      where: { ingredient: { id: ingredient.id } },
    });
    expect(stock?.quantity.toString()).toBe('50');

    const undoJob = makeJob({
      type: 'undo',
      preparationLogId: log.id,
    });
    const undoResult = await processor.process(undoJob);
    expect(undoResult.status).toBe('undone');

    stock = await inventoryRepo.findOne({
      where: { ingredient: { id: ingredient.id } },
    });
    expect(stock?.quantity.toString()).toBe('100');
  });

  it('should handle undo when inventory row was deleted and recreated', async () => {
    await makeUser();
    const ingredient = await makeIngredient({ name: 'Vodka', baseUnit: 'ml' });
    const inv = await makeInventory(ingredient, 50);
    const { cocktail, log } = await makeCocktailAndLog([
      { ingredient, amount: 50, unit: 'ml' },
    ]);

    const prepareJob = makeJob({
      type: 'prepare',
      cocktailId: cocktail.id,
      preparationLogId: log.id,
    });
    const prepareResult = await processor.process(prepareJob);
    expect(prepareResult.status).toBe('completed');

    // Verify stock is now 0 and delete it
    let stock = await inventoryRepo.findOne({
      where: { id: inv.id },
    });
    expect(stock?.quantity.toString()).toBe('0');

    // Delete the zero-quantity row (simulating cleanup)
    await inventoryRepo.remove(stock!);

    // Recreate a new inventory row for the same ingredient (new UUID)
    const newInv = await makeInventory(ingredient, 100);

    // Undo the original preparation
    const undoJob = makeJob({
      type: 'undo',
      preparationLogId: log.id,
    });
    const undoResult = await processor.process(undoJob);
    expect(undoResult.status).toBe('undone');

    // The new row should have its quantity increased
    stock = await inventoryRepo.findOne({
      where: { id: newInv.id },
    });
    expect(stock?.quantity.toString()).toBe('150');
  });

  it('should fail with insufficient stock when not in force mode', async () => {
    await makeUser();
    const ingredient = await makeIngredient({ name: 'Vodka', baseUnit: 'ml' });
    await makeInventory(ingredient, 10);
    const { cocktail, log } = await makeCocktailAndLog([
      { ingredient, amount: 50, unit: 'ml' },
    ]);

    const job = makeJob({
      cocktailId: cocktail.id,
      preparationLogId: log.id,
    });
    const result = await processor.process(job);

    expect(result.status).toBe('failed_insufficient_stock');

    const updatedLog = await logRepo.findOne({ where: { id: log.id } });
    expect(updatedLog?.status).toBe('failed_insufficient_stock');
  });

  it('should skip insufficient ingredients in force mode', async () => {
    await makeUser();
    const ingredient = await makeIngredient({ name: 'Vodka', baseUnit: 'ml' });
    await makeInventory(ingredient, 10);
    const { cocktail, log } = await makeCocktailAndLog([
      { ingredient, amount: 50, unit: 'ml' },
    ]);

    const job = makeJob({
      cocktailId: cocktail.id,
      preparationLogId: log.id,
      force: true,
    });
    const result = await processor.process(job);

    expect(result.status).toBe('completed');

    const updatedLog = await logRepo.findOne({ where: { id: log.id } });
    expect(updatedLog?.status).toBe('completed');
    const deduction = updatedLog?.deductedIngredients?.[0];
    expect(deduction?.skipped).toBe(true);
  });

  it('should handle part-based recipes with totalVolumeMl', async () => {
    await makeUser();
    const vodka = await makeIngredient({
      name: 'Vodka Part',
      baseUnit: 'ml',
    });
    const juice = await makeIngredient({
      name: 'Cranberry Juice',
      baseUnit: 'ml',
    });
    await makeInventory(vodka, 200);
    await makeInventory(juice, 200);

    const { cocktail, log } = await makeCocktailAndLog([
      { ingredient: vodka, amount: 2, unit: 'parts' },
      { ingredient: juice, amount: 3, unit: 'parts' },
    ]);

    const job = makeJob({
      cocktailId: cocktail.id,
      preparationLogId: log.id,
      totalVolumeMl: '150',
    });
    const result = await processor.process(job);

    expect(result.status).toBe('completed');

    // 150ml total, 5 parts total → 30ml/part
    // Vodka: 2 parts × 30 = 60ml deducted
    // Juice: 3 parts × 30 = 90ml deducted
    const vodkaStock = await inventoryRepo.findOne({
      where: { ingredient: { id: vodka.id } },
      relations: ['ingredient'],
    });
    const juiceStock = await inventoryRepo.findOne({
      where: { ingredient: { id: juice.id } },
      relations: ['ingredient'],
    });
    expect(vodkaStock?.quantity.toString()).toBe('140');
    expect(juiceStock?.quantity.toString()).toBe('110');
  });

  it('should handle multi-ingredient optional/garnish skipping', async () => {
    await makeUser();
    const vodka = await makeIngredient({
      name: 'Vodka Garnish Test',
      baseUnit: 'ml',
    });
    const garnish = await makeIngredient({
      name: 'Lemon Peel',
      baseUnit: 'count',
    });
    await makeInventory(vodka, 100);
    await makeInventory(garnish, 5);

    const { cocktail, log } = await makeCocktailAndLog([
      { ingredient: vodka, amount: 50, unit: 'ml' },
      { ingredient: garnish, amount: 1, unit: 'count' },
    ]);

    // Mark the garnish ingredient as garnish type via a raw update
    // (CocktailIngredient entity doesn't have a 'type' column directly, but it's accessed as reqAny)
    await dataSource.query(
      `UPDATE cocktail_ingredients SET type = 'garnish' WHERE ingredient_id = $1`,
      [garnish.id],
    );

    const job = makeJob({
      cocktailId: cocktail.id,
      preparationLogId: log.id,
    });
    const result = await processor.process(job);

    expect(result.status).toBe('completed');

    const updatedLog = await logRepo.findOne({ where: { id: log.id } });
    const deductions = updatedLog?.deductedIngredients ?? [];
    expect(deductions.length).toBe(2);

    const garnishDeduction = deductions.find(
      (d) => d.ingredientId === garnish.id,
    );
    expect(garnishDeduction).toBeDefined();
    // Garnish is count-based, compatible with count baseUnit, so it should deduct normally
    // rather than being treated as incompatible
  });

  it('should prevent double undo', async () => {
    await makeUser();
    const ingredient = await makeIngredient({ name: 'Vodka', baseUnit: 'ml' });
    await makeInventory(ingredient, 100);
    const { cocktail, log } = await makeCocktailAndLog([
      { ingredient, amount: 50, unit: 'ml' },
    ]);

    const prepareJob = makeJob({
      type: 'prepare',
      cocktailId: cocktail.id,
      preparationLogId: log.id,
    });
    await processor.process(prepareJob);

    const undoJob = makeJob({
      type: 'undo',
      preparationLogId: log.id,
    });
    await processor.process(undoJob);

    await expect(processor.process(undoJob)).rejects.toThrow(
      'has already been undone',
    );
  });

  it('should prevent undo of non-completed preparation', async () => {
    await makeUser();
    const ingredient = await makeIngredient({ name: 'Vodka', baseUnit: 'ml' });
    const { log } = await makeCocktailAndLog([
      { ingredient, amount: 50, unit: 'ml' },
    ]);

    const undoJob = makeJob({
      type: 'undo',
      preparationLogId: log.id,
    });
    await expect(processor.process(undoJob)).rejects.toThrow(
      'expected "completed"',
    );
  });

  it('should use descendant matching for parent ingredient inventory', async () => {
    await makeUser();
    // Create a parent ingredient (generic Whiskey)
    const parentWhiskey = await makeIngredient({
      name: 'Whiskey',
      baseUnit: 'ml',
    });
    // Create a child ingredient (Bourbon extends Whiskey)
    const bourbon = await makeIngredient({
      name: 'Bourbon',
      baseUnit: 'ml',
      parent: parentWhiskey,
      parentId: parentWhiskey.id,
    });
    // Stock only the parent (Whiskey) in inventory
    await makeInventory(parentWhiskey, 200);

    // Recipe uses Bourbon (child)
    const { cocktail, log } = await makeCocktailAndLog([
      { ingredient: bourbon, amount: 50, unit: 'ml' },
    ]);

    const job = makeJob({
      cocktailId: cocktail.id,
      preparationLogId: log.id,
    });
    const result = await processor.process(job);

    expect(result.status).toBe('completed');

    const stock = await inventoryRepo.findOne({
      where: { ingredient: { id: parentWhiskey.id } },
    });
    expect(stock?.quantity.toString()).toBe('150');
  });
});
