import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { CocktailsService } from './cocktails.service';
import { Cocktail } from './entities/cocktail.entity';
import { CocktailIngredient } from './entities/cocktail-ingredient.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';
import { PreparationLog } from './entities/preparation-log.entity';
import { CocktailDbService } from '../external/the-cocktail-db/cocktail-db.service';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';
import { MeasureParserService } from '../utils/measure-parser.service';
import { FavoritesService } from '../favorites/favorites.service';
import { RatingService } from './rating.service';
import { ImageService } from '../images/image.service';
import { CacheInvalidationService } from '../redis-cache/cache-invalidation.service';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID2 = '550e8400-e29b-41d4-a716-446655440001';

function mockUser(id = 'user-1'): User {
  return { id, email: 'test@test.com', role: 'bartender' } as User;
}

function mockIngredient(id = 'ing-1', name = 'Vodka'): Ingredient {
  return { id, name } as Ingredient;
}

function mockCocktailIngredient(
  cocktail: Cocktail,
  ingredient: Ingredient,
): CocktailIngredient {
  return {
    id: 'ci-1',
    cocktail,
    ingredient,
    measure: '2 oz',
    amount: new Decimal(2),
    unit: 'oz',
    type: 'regular',
    isOptional: false,
  };
}

function mockCocktail(
  id = VALID_UUID,
  name = 'Test Cocktail',
  isPublic = true,
): Cocktail {
  return {
    id,
    name,
    description: 'A test cocktail',
    instructions: 'Mix ingredients',
    isPublic,
    source: 'local',
    externalId: null,
    parentExternalId: null,
    imageFull: null,
    imageThumb: null,
    rating: null,
    ratingCount: 0,
    isDeleted: false,
    user: mockUser(),
    ingredients: [],
    createdAt: new Date(),
  } as Cocktail;
}

function mockPreparationLog(
  id = 'log-1',
  status: string = 'queued',
  undone = false,
  cocktailId = VALID_UUID,
): PreparationLog {
  return {
    id,
    bartenderId: 'user-1',
    cocktailId,
    cocktailNameSnapshot: 'Test Cocktail',
    servings: 1,
    deductedIngredients: null,
    status,
    undone,
    createdAt: new Date(),
  } as unknown as PreparationLog;
}

const createCocktailDto = {
  name: 'New Cocktail',
  description: 'Description',
  instructions: 'Shake well',
  ingredients: [
    {
      ingredientId: 'ing-1',
      amount: 2,
      unit: 'oz',
      measure: '2 oz',
    },
  ],
  isPublic: true,
};

// Helper to create a mock repository with `manager.transaction`
function mockRepo(overrides: Record<string, jest.Mock> = {}) {
  const manager = {
    transaction: jest.fn(),
    query: jest.fn(),
  };
  const base = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
    manager,
    ...overrides,
  };
  // Make `manager.transaction` callable like the real one
  return base;
}

// Helper to create a mock TypeORM query builder
function mockQueryBuilder() {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('CocktailsService', () => {
  let service: CocktailsService;
  let cocktailRepo: ReturnType<typeof mockRepo>;
  let cocktailIngredientRepo: ReturnType<typeof mockRepo>;
  let ingredientRepo: ReturnType<typeof mockRepo>;
  let userRepo: ReturnType<typeof mockRepo>;
  let preparationLogRepo: ReturnType<typeof mockRepo>;
  let barOrdersQueue: { add: jest.Mock };
  let favoritesService: FavoritesService;
  let cacheInvalidation: CacheInvalidationService;

  beforeEach(async () => {
    barOrdersQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    cocktailRepo = mockRepo();
    cocktailIngredientRepo = mockRepo();
    ingredientRepo = mockRepo();
    userRepo = mockRepo();
    preparationLogRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CocktailsService,
        {
          provide: getRepositoryToken(Cocktail),
          useValue: cocktailRepo,
        },
        {
          provide: getRepositoryToken(CocktailIngredient),
          useValue: cocktailIngredientRepo,
        },
        {
          provide: getRepositoryToken(Ingredient),
          useValue: ingredientRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
        {
          provide: getRepositoryToken(PreparationLog),
          useValue: preparationLogRepo,
        },
        { provide: getQueueToken('bar-orders'), useValue: barOrdersQueue },
        {
          provide: CocktailDbService,
          useValue: { getCocktailById: jest.fn() },
        },
        {
          provide: HierarchicalIngredientService,
          useValue: { findBestMatch: jest.fn() },
        },
        {
          provide: MeasureParserService,
          useValue: {
            parse: jest.fn().mockReturnValue({ amount: 2, unit: 'oz' }),
          },
        },
        {
          provide: FavoritesService,
          useValue: {
            migrateFavoritePointer: jest.fn().mockResolvedValue(undefined),
            countFavorites: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: RatingService,
          useValue: {
            migrateExternalRating: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ImageService,
          useValue: { processAndSaveBuffer: jest.fn() },
        },
        {
          provide: CacheInvalidationService,
          useValue: { clearByPatterns: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<CocktailsService>(CocktailsService);
    favoritesService = module.get(FavoritesService);
    cacheInvalidation = module.get(CacheInvalidationService);
  });

  // ====================
  // findAll
  // ====================
  describe('findAll', () => {
    it('should return paginated cocktails', async () => {
      const c = mockCocktail();
      cocktailRepo.findAndCount.mockResolvedValue([[c], 1]);

      const result = await service.findAll({ limit: 10, page: 1 });
      expect(result.data).toEqual([c]);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.currentPage).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should return empty list when no cocktails', async () => {
      cocktailRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ limit: 10, page: 1 });
      expect(result.data).toEqual([]);
      expect(result.meta.totalItems).toBe(0);
      expect(result.meta.nextPage).toBeNull();
    });

    it('should use default pagination', async () => {
      await service.findAll({});
      expect(cocktailRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });
  });

  // ====================
  // searchByName
  // ====================
  describe('searchByName', () => {
    it('should search cocktails by name with LIKE', async () => {
      const qb = mockQueryBuilder();
      cocktailRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await service.searchByName('mojito', { limit: 10, page: 1 });
      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('should use fuzzy search when fuzzy option is set', async () => {
      const qb = mockQueryBuilder();
      cocktailRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await service.searchByName(
        'mojito',
        { limit: 10, page: 1 },
        { fuzzy: true },
      );
      expect(qb.addSelect).toHaveBeenCalled();
      expect(qb.orderBy).toHaveBeenCalled();
    });
  });

  // ====================
  // findOne
  // ====================
  describe('findOne', () => {
    it('should return a cocktail by id', async () => {
      const c = mockCocktail();
      cocktailRepo.findOne.mockResolvedValue(c);

      const result = await service.findOne(VALID_UUID);
      expect(result).toEqual(c);
    });

    it('should throw NotFoundException when cocktail not found', async () => {
      cocktailRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(VALID_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for non-UUID id', async () => {
      await expect(service.findOne('not-a-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ====================
  // create
  // ====================
  describe('create', () => {
    it('should create a cocktail with ingredients', async () => {
      const user = mockUser();
      const ingredient = mockIngredient();
      const cocktail = mockCocktail('new-id', 'New Cocktail');

      userRepo.findOne.mockResolvedValue(user);
      ingredientRepo.findOne.mockResolvedValue(ingredient);
      cocktailRepo.create.mockReturnValue(cocktail);
      cocktailRepo.manager.transaction.mockImplementation((cb: any) => {
        const em = {
          save: jest.fn().mockResolvedValue(cocktail),
          findOne: jest.fn().mockResolvedValue(ingredient),
          create: jest.fn().mockReturnValue({}),
        };
        return cb(em);
      });
      cocktailRepo.findOne.mockResolvedValue({
        ...cocktail,
        ingredients: [mockCocktailIngredient(cocktail, ingredient)],
      });

      const result = await service.create(createCocktailDto, 'user-1');
      expect(result.name).toBe('New Cocktail');
      expect(result.id).toBe('new-id');
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(createCocktailDto, 'nonexistent-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if ingredient not found', async () => {
      const user = mockUser();
      const cocktail = mockCocktail('new-id');

      userRepo.findOne.mockResolvedValue(user);
      ingredientRepo.findOne.mockResolvedValue(null);
      cocktailRepo.create.mockReturnValue(cocktail);
      cocktailRepo.manager.transaction.mockImplementation((cb: any) => {
        const em = {
          save: jest.fn().mockResolvedValue(cocktail),
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockReturnValue({}),
        };
        return cb(em);
      });

      await expect(service.create(createCocktailDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException if retrieval after create fails', async () => {
      const user = mockUser();
      const ingredient = mockIngredient();
      const cocktail = mockCocktail('new-id');

      userRepo.findOne.mockResolvedValue(user);
      ingredientRepo.findOne.mockResolvedValue(ingredient);
      cocktailRepo.create.mockReturnValue(cocktail);
      cocktailRepo.manager.transaction.mockImplementation((cb: any) => {
        const em = {
          save: jest.fn().mockResolvedValue(cocktail),
          findOne: jest.fn().mockResolvedValue(ingredient),
          create: jest.fn().mockReturnValue({}),
        };
        return cb(em);
      });
      cocktailRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createCocktailDto, 'user-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should strip ext- prefix from parentExternalId', async () => {
      const user = mockUser();
      const ingredient = mockIngredient();
      const cocktail = mockCocktail('new-id');

      userRepo.findOne.mockResolvedValue(user);
      ingredientRepo.findOne.mockResolvedValue(ingredient);
      cocktailRepo.create.mockReturnValue(cocktail);
      cocktailRepo.manager.transaction.mockImplementation((cb: any) => {
        const em = {
          save: jest.fn().mockResolvedValue(cocktail),
          findOne: jest.fn().mockResolvedValue(ingredient),
          create: jest.fn().mockReturnValue({}),
        };
        return cb(em);
      });
      cocktailRepo.findOne.mockResolvedValue(cocktail);

      await service.create(
        { ...createCocktailDto, parentExternalId: 'ext-12345' },
        'user-1',
      );
      expect(
        // eslint-disable-next-line @typescript-eslint/unbound-method
        favoritesService.migrateFavoritePointer as jest.Mock,
      ).toHaveBeenCalledWith('user-1', '12345', 'new-id');
    });
  });

  // ====================
  // prepare
  // ====================
  describe('prepare', () => {
    it('should queue a preparation job and return status', async () => {
      const cocktail = mockCocktail();
      const log = mockPreparationLog();

      cocktailRepo.findOne.mockResolvedValue(cocktail);
      preparationLogRepo.create.mockReturnValue(log);
      preparationLogRepo.save.mockResolvedValue(log);

      const result = await service.prepare(VALID_UUID, 'user-1', 2);

      expect(result.message).toBe('Cocktail preparation queued');
      expect(result.status).toBe('queued');
      expect(barOrdersQueue.add).toHaveBeenCalledWith(
        'prepare-cocktail',
        expect.objectContaining({ servings: 2 }),
      );
    });

    it('should throw BadRequestException for invalid total volume', async () => {
      await expect(
        service.prepare(VALID_UUID, 'user-1', 1, 'not-a-number'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for zero total volume', async () => {
      await expect(
        service.prepare(VALID_UUID, 'user-1', 1, '0'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for excessive total volume', async () => {
      await expect(
        service.prepare(VALID_UUID, 'user-1', 1, '20000'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should find cocktail by parentExternalId when UUID lookup fails', async () => {
      cocktailRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCocktail());

      const log = mockPreparationLog();
      preparationLogRepo.create.mockReturnValue(log);
      preparationLogRepo.save.mockResolvedValue(log);

      const result = await service.prepare(VALID_UUID, 'user-1');

      expect(result.status).toBe('queued');
    });
  });

  // ====================
  // batchPrepare
  // ====================
  describe('batchPrepare', () => {
    it('should queue a batch preparation job', async () => {
      const log = mockPreparationLog();
      preparationLogRepo.create.mockReturnValue(log);
      preparationLogRepo.save.mockResolvedValue(log);

      const result = await service.batchPrepare('user-1', [
        { cocktailId: VALID_UUID, servings: 1 },
        { cocktailId: VALID_UUID, servings: 2 },
      ]);

      expect(result.status).toBe('queued');
      expect(barOrdersQueue.add).toHaveBeenCalledWith(
        'batch-prepare-cocktail',
        expect.objectContaining({ batchOrders: expect.any(Array) }),
      );
    });

    it('should throw BadRequestException for empty orders', async () => {
      await expect(service.batchPrepare('user-1', [])).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ====================
  // undo
  // ====================
  describe('undo', () => {
    it('should queue an undo job for a completed preparation', async () => {
      const log = mockPreparationLog('log-1', 'completed');
      preparationLogRepo.findOne.mockResolvedValue(log);
      preparationLogRepo.manager.query.mockResolvedValue([
        {
          id: 'log-1',
          bartender_id: 'user-1',
          cocktail_id: VALID_UUID,
          status: 'completed',
          undone: false,
        },
      ]);

      const result = await service.undo('log-1');
      expect(result.status).toBe('queued');
      expect(barOrdersQueue.add).toHaveBeenCalledWith(
        'undo-preparation',
        expect.objectContaining({ type: 'undo' }),
      );
    });

    it('should throw NotFoundException when log not found', async () => {
      preparationLogRepo.findOne.mockResolvedValue(null);

      await expect(service.undo('nonexistent-log')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when log is not completed', async () => {
      const log = mockPreparationLog('log-1', 'queued');
      preparationLogRepo.findOne.mockResolvedValue(log);

      await expect(service.undo('log-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when already undone', async () => {
      const log = mockPreparationLog('log-1', 'completed', true);
      preparationLogRepo.findOne.mockResolvedValue(log);

      await expect(service.undo('log-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ====================
  // getPreparationStatus
  // ====================
  describe('getPreparationStatus', () => {
    it('should return preparation status', async () => {
      const log = mockPreparationLog('log-1', 'queued');
      preparationLogRepo.findOne.mockResolvedValue(log);

      const result = await service.getPreparationStatus('log-1');
      expect(result.status).toBe('queued');
      expect(result.preparationLogId).toBe('log-1');
    });

    it('should throw NotFoundException when log not found', async () => {
      preparationLogRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getPreparationStatus('nonexistent-log'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ====================
  // cancelPreparation
  // ====================
  describe('cancelPreparation', () => {
    it('should cancel a queued preparation', async () => {
      const log = mockPreparationLog('log-1', 'queued');
      preparationLogRepo.findOne.mockResolvedValue(log);
      preparationLogRepo.save.mockResolvedValue({
        ...log,
        status: 'cancelled',
      });

      const result = await service.cancelPreparation('log-1');
      expect(result.status).toBe('cancelled');
    });

    it('should throw BadRequestException when already completed', async () => {
      const log = mockPreparationLog('log-1', 'completed');
      preparationLogRepo.findOne.mockResolvedValue(log);

      await expect(service.cancelPreparation('log-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when already cancelled', async () => {
      const log = mockPreparationLog('log-1', 'cancelled');
      preparationLogRepo.findOne.mockResolvedValue(log);

      await expect(service.cancelPreparation('log-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when already being prepared', async () => {
      const log = mockPreparationLog('log-1', 'preparing');
      preparationLogRepo.findOne.mockResolvedValue(log);

      await expect(service.cancelPreparation('log-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when log not found', async () => {
      preparationLogRepo.findOne.mockResolvedValue(null);

      await expect(
        service.cancelPreparation('nonexistent-log'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ====================
  // update
  // ====================
  describe('update', () => {
    it('should update a cocktail', async () => {
      const cocktail = mockCocktail(VALID_UUID, 'Old Name');
      cocktailRepo.findOne.mockResolvedValue(cocktail);
      (favoritesService.countFavorites as jest.Mock).mockResolvedValue(0);
      cocktailRepo.save.mockResolvedValue({
        ...cocktail,
        name: 'Updated Name',
      });

      const result = await service.update(VALID_UUID, { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(cacheInvalidation.clearByPatterns as jest.Mock).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not owner', async () => {
      const otherUser = { ...mockUser(), id: 'other-user' };
      const cocktail = { ...mockCocktail(), user: otherUser };
      cocktailRepo.findOne.mockResolvedValue(cocktail);

      await expect(
        service.update(VALID_UUID, { name: 'Updated' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should fork cocktail when public with favorites instead of updating in-place', async () => {
      const cocktail = mockCocktail(VALID_UUID, 'Popular');
      cocktailRepo.findOne.mockResolvedValue(cocktail);
      (favoritesService.countFavorites as jest.Mock).mockResolvedValue(5);

      const user = mockUser();
      const ingredient = mockIngredient();
      const newCocktail = mockCocktail('new-id', 'Popular');

      userRepo.findOne.mockResolvedValue(user);
      ingredientRepo.findOne.mockResolvedValue(ingredient);
      cocktailRepo.create.mockReturnValue(newCocktail);
      cocktailRepo.manager.transaction.mockImplementation((cb: any) => {
        const em = {
          save: jest.fn().mockResolvedValue(newCocktail),
          findOne: jest.fn().mockResolvedValue(ingredient),
          create: jest.fn().mockReturnValue({}),
        };
        return cb(em);
      });

      const finalCocktail = {
        ...newCocktail,
        id: 'new-id',
        ingredients: [mockCocktailIngredient(newCocktail, ingredient)],
      };
      cocktailRepo.findOne.mockResolvedValue(finalCocktail);

      const result = await service.update(
        VALID_UUID,
        { name: 'Popular (Updated)' },
        'user-1',
      );
      expect(result.id).toBe('new-id');
    });

    it('should throw NotFoundException when cocktail not found', async () => {
      cocktailRepo.findOne.mockResolvedValue(null);

      await expect(service.update(VALID_UUID2, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ====================
  // remove
  // ====================
  describe('remove', () => {
    it('should soft-delete a cocktail', async () => {
      const cocktail = mockCocktail(VALID_UUID);
      cocktailRepo.findOne.mockResolvedValue(cocktail);
      cocktailRepo.save.mockResolvedValue({
        ...cocktail,
        isDeleted: true,
      });

      const result = await service.remove(VALID_UUID);
      expect(result.isDeleted).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(cacheInvalidation.clearByPatterns as jest.Mock).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not owner', async () => {
      const otherUser = { ...mockUser(), id: 'other-user' };
      const cocktail = { ...mockCocktail(), user: otherUser };
      cocktailRepo.findOne.mockResolvedValue(cocktail);

      await expect(service.remove(VALID_UUID, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when cocktail not found', async () => {
      cocktailRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(VALID_UUID2)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
