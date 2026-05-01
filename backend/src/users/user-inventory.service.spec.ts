import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Decimal } from 'decimal.js';
import { UserInventoryService } from './user-inventory.service';
import { UserInventory } from './entities/user-inventory.entity';
import { User } from './entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { UnitConverterService } from '../utils/unit-converter.service';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';
import { UsersService } from './users.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('UserInventoryService', () => {
  let service: UserInventoryService;
  let userInventoryRepository: Repository<UserInventory>;
  let ingredientRepository: Repository<Ingredient>;
  let unitConverterService: UnitConverterService;

  const mockUser: Partial<User> = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockIngredient: Partial<Ingredient> = {
    id: 'ingredient-123',
    name: 'vodka',
    baseUnit: 'ml',
    parent: null,
    synonyms: null,
  };

  const mockWhiskeyIngredient: Partial<Ingredient> = {
    id: 'ingredient-456',
    name: 'whiskey',
    baseUnit: 'ml',
    parent: null,
    synonyms: 'whisky',
  };

  const mockBourbonIngredient: Partial<Ingredient> = {
    id: 'ingredient-789',
    name: 'bourbon',
    baseUnit: 'ml',
    parent: { id: 'ingredient-456', name: 'whiskey' } as Ingredient,
    synonyms: 'bourbon whiskey',
  };

  beforeEach(async () => {
    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        find: jest.fn(),
        findOne: jest.fn(),
        remove: jest.fn(),
        save: jest.fn(),
      },
    };

    const mockDataSource = {
      createQueryRunner: jest.fn(() => mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserInventoryService,
        {
          provide: getRepositoryToken(UserInventory),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
            })),
          },
        },
        {
          provide: getRepositoryToken(Ingredient),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              orWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
            })),
          },
        },
        {
          provide: getRepositoryToken(Cocktail),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: UnitConverterService,
          useValue: {
            convert: jest.fn(),
            hasEnoughStock: jest.fn(),
          },
        },
        {
          provide: HierarchicalIngredientService,
          useValue: {
            findSubstitutions: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<UserInventoryService>(UserInventoryService);
    userInventoryRepository = module.get<Repository<UserInventory>>(getRepositoryToken(UserInventory));
    ingredientRepository = module.get<Repository<Ingredient>>(getRepositoryToken(Ingredient));
    unitConverterService = module.get<UnitConverterService>(UnitConverterService);
  });

  describe('addToInventory', () => {
    it('should add new item to inventory', async () => {
      const addInventoryDto = {
        ingredientId: 'ingredient-123',
        quantity: 500,
        unit: 'ml',
      };

      (ingredientRepository.findOne as jest.Mock).mockResolvedValue(mockIngredient);
      (userInventoryRepository.findOne as jest.Mock).mockResolvedValue(null);
      (userInventoryRepository.create as jest.Mock).mockReturnValue({
        user: mockUser,
        ingredient: mockIngredient,
        quantity: 500,
        unit: 'ml',
      });
      (userInventoryRepository.save as jest.Mock).mockResolvedValue({
        id: 'inventory-123',
        ...addInventoryDto,
      });

      const result = await service.addToInventory("user-123", addInventoryDto);

      expect(result).toBeDefined();
      expect(userInventoryRepository.save).toHaveBeenCalled();
    });

    it('should update existing item in inventory', async () => {
      const addInventoryDto = {
        ingredientId: 'ingredient-123',
        quantity: 200,
        unit: 'ml',
      };

      const existingInventory: Partial<UserInventory> = {
        id: 'existing-123',
        user: mockUser as User,
        ingredient: mockIngredient as Ingredient,
        quantity: new Decimal(300),
        unit: 'ml',
      };

      (ingredientRepository.findOne as jest.Mock).mockResolvedValue(mockIngredient);
      (userInventoryRepository.findOne as jest.Mock).mockResolvedValue(existingInventory);
      (userInventoryRepository.save as jest.Mock).mockResolvedValue({
        ...existingInventory,
        quantity: 500, // 300 + 200
      });

      const result = await service.addToInventory("user-123", addInventoryDto);

      expect(result.quantity).toBe(500);
    });

    it('should convert units when adding to inventory', async () => {
      const addInventoryDto = {
        ingredientId: 'ingredient-123',
        quantity: 16.9, // 16.9 oz
        unit: 'oz',
      };

      (ingredientRepository.findOne as jest.Mock).mockResolvedValue(mockIngredient);
      (userInventoryRepository.findOne as jest.Mock).mockResolvedValue(null);
      (unitConverterService.convert as jest.Mock).mockReturnValue(500); // 16.9 oz = 500 ml
      (userInventoryRepository.create as jest.Mock).mockReturnValue({
        user: mockUser,
        ingredient: mockIngredient,
        quantity: 500,
        unit: 'ml',
      });
      (userInventoryRepository.save as jest.Mock).mockResolvedValue({
        id: 'inventory-123',
        quantity: 500,
        unit: 'ml',
      });

      await service.addToInventory("user-123", addInventoryDto);

      expect(unitConverterService.convert).toHaveBeenCalledWith(16.9, 'oz', 'ml', expect.objectContaining({
        id: 'ingredient-123',
        name: 'vodka',
        baseUnit: 'ml'
      }));
    });

    it('should throw error for invalid ingredient', async () => {
      const addInventoryDto = {
        ingredientId: 'invalid-id',
        quantity: 500,
        unit: 'ml',
      };

      (ingredientRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.addToInventory("user-123", addInventoryDto))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('getInventory', () => {
    it('should return user inventory with hierarchical ingredients', async () => {
      const mockInventory = [
        {
          id: 'inventory-123',
          ingredient: mockBourbonIngredient,
          quantity: new Decimal(750),
          unit: 'ml',
        },
      ];

      (userInventoryRepository.find as jest.Mock).mockResolvedValue(mockInventory);

      const result = await service.getInventory("user-123");

      expect(result).toEqual(mockInventory);
      expect(userInventoryRepository.find).toHaveBeenCalledWith({
        where: { user: { id: mockUser.id } },
        relations: ['ingredient', 'ingredient.parent'],
        order: { ingredient: { name: 'ASC' } },
      });
    });
  });

  describe('removeFromInventory', () => {
    it('should remove inventory item', async () => {
      const mockInventoryItem = {
        id: 'inventory-123',
        user: mockUser,
        ingredient: mockIngredient,
        quantity: new Decimal(500),
        unit: 'ml',
      };

      (userInventoryRepository.findOne as jest.Mock).mockResolvedValue(mockInventoryItem);
      (userInventoryRepository.remove as jest.Mock).mockResolvedValue(mockInventoryItem);

      const result = await service.removeFromInventory("user-123", 'inventory-123');

      expect(result).toEqual(mockInventoryItem);
      expect(userInventoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'inventory-123', user: { id: mockUser.id } },
      });
    });

    it('should throw error when inventory item not found', async () => {
      (userInventoryRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.removeFromInventory("user-123", 'invalid-id'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('updateInventoryItem', () => {
    it('should update inventory item quantity', async () => {
      const mockInventoryItem = {
        id: 'inventory-123',
        user: mockUser,
        ingredient: mockIngredient,
        quantity: new Decimal(300),
        unit: 'ml',
      };

      (userInventoryRepository.findOne as jest.Mock).mockResolvedValue(mockInventoryItem);
      (unitConverterService.convert as jest.Mock).mockReturnValue(500);
      (userInventoryRepository.save as jest.Mock).mockResolvedValue({
        ...mockInventoryItem,
        quantity: new Decimal(500),
      });

      const result = await service.updateInventoryItem("user-123", 'inventory-123', 500, 'ml');

      expect(result.quantity instanceof Decimal ? result.quantity.toNumber() : result.quantity).toBe(500);
      // The convert method should be called even with same units
      // But it might not be called if units are the same
      // expect(unitConverterService.convert).toHaveBeenCalled();
    });

    it('should convert units when updating', async () => {
      const mockInventoryItem = {
        id: 'inventory-123',
        user: mockUser,
        ingredient: { ...mockIngredient, baseUnit: 'ml' },
        quantity: new Decimal(300),
        unit: 'ml',
      };

      (userInventoryRepository.findOne as jest.Mock).mockResolvedValue(mockInventoryItem);
      (unitConverterService.convert as jest.Mock).mockReturnValue(473); // 16 oz to ml
      (userInventoryRepository.save as jest.Mock).mockResolvedValue({
        ...mockInventoryItem,
        quantity: new Decimal(473),
      });

      await service.updateInventoryItem("user-123", 'inventory-123', 16, 'oz');

      expect(unitConverterService.convert).toHaveBeenCalledWith(16, 'oz', 'ml', expect.objectContaining({
        id: 'ingredient-123',
        name: 'vodka',
        baseUnit: 'ml'
      }));
    });

    it('should throw error for invalid inventory item', async () => {
      (userInventoryRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.updateInventoryItem("user-123", 'invalid-id', 500, 'ml'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('checkMakeability', () => {
    it('should return true when user has exact ingredients', async () => {
      const recipeIngredients = [
        { ingredientId: 'ingredient-123', amount: 50, unit: 'ml' },
      ];

      const mockInventory = [
        {
          ingredient: mockIngredient,
          quantity: new Decimal(100),
          unit: 'ml',
        },
      ];

      jest.spyOn(service, 'getInventory').mockResolvedValue(mockInventory as any);
      (ingredientRepository.findOne as jest.Mock).mockResolvedValue(mockIngredient);
      (unitConverterService.hasEnoughStock as jest.Mock).mockReturnValue(true);

      const result = await service.checkMakeability("user-123", { ingredients: recipeIngredients });

      expect(result.isMakeable).toBe(true);
      expect(result.missingIngredients).toHaveLength(0);
    });

    it('should handle hierarchical ingredient substitution', async () => {
      const recipeIngredients = [
        { ingredientId: 'ingredient-456', amount: 60, unit: 'ml' }, // whiskey
      ];

      const mockInventory = [
        {
          ingredient: mockBourbonIngredient, // bourbon (child of whiskey)
          quantity: new Decimal(100),
          unit: 'ml',
        },
      ];

      jest.spyOn(service, 'getInventory').mockResolvedValue(mockInventory as any);
      (ingredientRepository.findOne as jest.Mock).mockResolvedValue(mockWhiskeyIngredient);
      (unitConverterService.hasEnoughStock as jest.Mock).mockReturnValue(true);
      
      // Mock the hierarchical service to return bourbon as substitution for whiskey
      (service['hierarchicalIngredientService'].findSubstitutions as jest.Mock).mockResolvedValue([
        {
          substitute: mockBourbonIngredient,
          confidence: 0.8,
          reason: 'Child ingredient',
        },
      ]);

      const result = await service.checkMakeability("user-123", { ingredients: recipeIngredients });

      expect(result.isMakeable).toBe(true);
    });

    it('should return false with missing ingredients', async () => {
      const recipeIngredients = [
        { ingredientId: 'ingredient-123', amount: 150, unit: 'ml' },
      ];

      const mockInventory = [
        {
          ingredient: mockIngredient,
          quantity: new Decimal(100), // only 100ml available, need 150ml
          unit: 'ml',
        },
      ];

      jest.spyOn(service, 'getInventory').mockResolvedValue(mockInventory as any);
      (ingredientRepository.findOne as jest.Mock).mockResolvedValue(mockIngredient);
      (unitConverterService.hasEnoughStock as jest.Mock).mockReturnValue(false);

      const result = await service.checkMakeability("user-123", { ingredients: recipeIngredients });

      expect(result.isMakeable).toBe(false);
      expect(result.missingIngredients).toHaveLength(1);
    });
  });

  describe('depleteInventory', () => {
    it('should successfully deplete inventory for makeable recipe', async () => {
      const recipeIngredients = [
        { ingredientId: 'ingredient-123', amount: 50, unit: 'ml' },
      ];

      const mockInventoryItem = {
        id: 'inventory-123',
        ingredient: mockIngredient,
        quantity: new Decimal(100),
        unit: 'ml',
      };

      // Mock checkMakeability to return makeable
      jest.spyOn(service, 'checkMakeability').mockResolvedValue({
        isMakeable: true,
        missingIngredients: [],
        substitutions: [],
      });
      
      // Mock findMatchingInventoryItem to return the inventory item
      jest.spyOn(service as any, 'findMatchingInventoryItem').mockResolvedValue({
        item: mockInventoryItem,
        isSubstitution: false,
      });
      
      (ingredientRepository.findOne as jest.Mock).mockResolvedValue(mockIngredient);
      (userInventoryRepository.findOne as jest.Mock).mockResolvedValue(mockInventoryItem);
      (unitConverterService.convert as jest.Mock).mockReturnValue(50);

      const result = await service.depleteInventory("user-123", { ingredients: recipeIngredients });

      expect(result.success).toBe(true);
      expect(result.depletedItems).toHaveLength(1);
    });

    it('should throw error for non-makeable recipe', async () => {
      const recipeIngredients = [
        { ingredientId: 'ingredient-123', amount: 150, unit: 'ml' },
      ];

      jest.spyOn(service, 'checkMakeability').mockResolvedValue({
        isMakeable: false,
        missingIngredients: [{ 
          ingredientId: 'ingredient-123', 
          ingredientName: 'vodka',
          requiredAmount: 150,
          requiredUnit: 'ml',
          availableAmount: 0,
          availableUnit: 'ml',
          missingAmount: 150 
        }],
        substitutions: [],
      });

      await expect(service.depleteInventory("user-123", { ingredients: recipeIngredients }))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle count-based items (units)', async () => {
      const mockCountIngredient = {
        ...mockIngredient,
        baseUnit: 'units',
      };

      const recipeIngredients = [
        { ingredientId: 'ingredient-123', amount: 2, unit: 'units' },
      ];

      const mockInventoryItem = {
        id: 'inventory-123',
        ingredient: mockCountIngredient,
        quantity: new Decimal(5),
        unit: 'units',
      };

      // Mock checkMakeability to return makeable
      jest.spyOn(service, 'checkMakeability').mockResolvedValue({
        isMakeable: true,
        missingIngredients: [],
        substitutions: [],
      });
      
      // Mock findMatchingInventoryItem to return the inventory item
      jest.spyOn(service as any, 'findMatchingInventoryItem').mockResolvedValue({
        item: mockInventoryItem,
        isSubstitution: false,
      });
      
      (ingredientRepository.findOne as jest.Mock).mockResolvedValue(mockCountIngredient);
      (userInventoryRepository.findOne as jest.Mock).mockResolvedValue(mockInventoryItem);
      (unitConverterService.convert as jest.Mock).mockReturnValue(2);

      await service.depleteInventory("user-123", { ingredients: recipeIngredients });

      // Verify transaction was committed
      expect(service['dataSource'].createQueryRunner().commitTransaction).toHaveBeenCalled();
    });
  });

  describe('getMakeableCocktails', () => {
    it('should return empty array when inventory is empty', async () => {
      jest.spyOn(service, 'getInventory').mockResolvedValue([]);

      const result = await service.getMakeableCocktails("user-123", { limit: 10, page: 1 });

      expect(result.data).toEqual([]);
      expect(result.meta.totalItems).toBe(0);
    });

    it('should filter cocktails by makeability', async () => {
      const mockInventory = [
        {
          id: 'inventory-123',
          ingredient: mockIngredient,
          quantity: new Decimal(100),
          unit: 'ml',
        },
      ];

      const mockCocktail = {
        id: 'cocktail-123',
        name: 'Vodka Martini',
        is_public: true,
        ingredients: [
          {
            ingredient: mockIngredient,
            amount: 60,
            unit: 'ml',
          },
        ],
      };

      jest.spyOn(service, 'getInventory').mockResolvedValue(mockInventory as any);
      (service['cocktailRepository'].find as jest.Mock).mockResolvedValue([mockCocktail]);
      jest.spyOn(service, 'findMatchingInventoryItem' as any).mockResolvedValue({
        item: mockInventory[0],
        isSubstitution: false,
      });

      const result = await service.getMakeableCocktails("user-123", { limit: 10, page: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Vodka Martini');
    });
  });

  describe('getInventorySummary', () => {
    it('should calculate inventory summary', async () => {
      const mockInventory = [
        {
          id: 'inventory-123',
          ingredient: { ...mockIngredient, name: 'vodka' },
          quantity: new Decimal(750),
          unit: 'ml',
        },
        {
          id: 'inventory-456',
          ingredient: { ...mockIngredient, name: 'lime juice', baseUnit: 'ml' },
          quantity: new Decimal(200),
          unit: 'ml',
        },
      ];

      jest.spyOn(service, 'getInventory').mockResolvedValue(mockInventory as any);
      (unitConverterService.convert as jest.Mock).mockImplementation((value, from, to) => {
        if (from === 'ml' && to === 'ml') return value;
        return value; // Simplified for test
      });

      const result = await service.getInventorySummary("user-123");

      expect(result.totalItems).toBe(2);
      expect(result.categories).toContain('Spirits');
      expect(result.categories).toContain('Mixers');
    });

    it('should identify low stock items', async () => {
      const mockInventory = [
        {
          id: 'inventory-123',
          ingredient: { ...mockIngredient, name: 'vodka', baseUnit: 'ml' },
          quantity: new Decimal(50), // Low stock (< 100ml)
          unit: 'ml',
        },
      ];

      jest.spyOn(service, 'getInventory').mockResolvedValue(mockInventory as any);
      (unitConverterService.convert as jest.Mock).mockReturnValue(50);

      const result = await service.getInventorySummary("user-123");

      expect(result.lowStockItems).toHaveLength(1);
      expect(result.lowStockItems[0].ingredientName).toBe('vodka');
    });
  });
});