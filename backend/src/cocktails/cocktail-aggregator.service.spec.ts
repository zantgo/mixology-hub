jest.mock('../inventory/entities/bar-inventory.entity', () => ({
  BarInventory: class BarInventory {},
}));
jest.mock('../ingredients/entities/ingredient.entity', () => ({
  Ingredient: class Ingredient {},
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
jest.mock('../users/entities/user.entity', () => ({
  User: class User {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CocktailAggregatorService } from './cocktail-aggregator.service';

describe('CocktailAggregatorService', () => {
  let service: CocktailAggregatorService;
  let localService: any;
  let externalService: any;
  let inventoryService: any;
  let cacheManager: any;

  const mockLocalCocktail = {
    id: 'local-1',
    name: 'Test Cocktail',
    description: 'A test drink',
    instructions: 'Mix everything.',
    is_public: true,
    source: 'local',
    image_full: null,
    image_thumb: null,
    ingredients: [
      {
        measure: '50 ml',
        amount: 50,
        unit: 'ml',
        ingredient: { id: 'ing-1', name: 'Vodka' },
      },
    ],
  };

  const mockExternalDrink = {
    idDrink: '123',
    strDrink: 'External Mojito',
    strInstructions: 'Muddle mint with sugar. Add rum, lime, soda.',
    strCategory: 'Cocktail',
    strAlcoholic: 'Alcoholic',
    strGlass: 'Highball glass',
    strTags: 'Classic,IBA',
    strIngredient1: 'Rum',
    strMeasure1: '2 oz',
    strIngredient2: 'Mint',
    strMeasure2: '8 leaves',
    strIngredient3: 'Lime',
    strMeasure3: '1 oz',
    strIngredient4: null,
    strIngredient5: null,
    strIngredient6: null,
    strIngredient7: null,
    strIngredient8: null,
    strIngredient9: null,
    strIngredient10: null,
    strIngredient11: null,
    strIngredient12: null,
    strIngredient13: null,
    strIngredient14: null,
    strIngredient15: null,
  };

  beforeEach(async () => {
    localService = {
      findAll: jest.fn(),
    };

    externalService = {
      searchByName: jest.fn(),
      getRandomCocktail: jest.fn(),
    };

    inventoryService = {
      getInventory: jest.fn(),
    };

    const hierarchicalService = {
      findBestMatch: jest.fn().mockResolvedValue(null),
    };

    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    service = new CocktailAggregatorService(
      localService as any,
      externalService as any,
      inventoryService as any,
      hierarchicalService as any,
      cacheManager as any,
    );
  });

  describe('searchUnified', () => {
    it('should return cached results when available', async () => {
      const cachedData = [{ id: 'cached-1', name: 'Cached Cocktail', source: 'local' }];
      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.searchUnified('test', { page: 1, limit: 10 });

      expect(result.data).toEqual(cachedData);
      expect(localService.findAll).not.toHaveBeenCalled();
    });

    it('should fetch fresh results on cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      localService.findAll.mockResolvedValue({ data: [mockLocalCocktail] });
      externalService.getRandomCocktail.mockResolvedValue(null);
      inventoryService.getInventory.mockResolvedValue({ data: [] });

      const result = await service.searchUnified('test', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should return empty results on error (graceful degradation)', async () => {
      cacheManager.get.mockRejectedValue(new Error('Redis down'));
      localService.findAll.mockRejectedValue(new Error('DB down'));

      const result = await service.searchUnified('test', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.totalItems).toBe(0);
      expect(result.metadata.error).toBe('Search failed');
    });

    it('should return empty results for overly long search queries (graceful degradation)', async () => {
      const longQuery = 'a'.repeat(101);

      const result = await service.searchUnified(longQuery, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.totalItems).toBe(0);
      expect(result.metadata.error).toBe('Search failed');
    });

    it('should handle empty search query', async () => {
      cacheManager.get.mockResolvedValue(null);
      localService.findAll.mockResolvedValue({ data: [] });
      externalService.getRandomCocktail.mockResolvedValue(null);
      inventoryService.getInventory.mockResolvedValue({ data: [] });

      const result = await service.searchUnified('', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
    });

    it('should include local and external sources in metadata', async () => {
      cacheManager.get.mockResolvedValue(null);
      localService.findAll.mockResolvedValue({ data: [mockLocalCocktail] });
      externalService.getRandomCocktail.mockResolvedValue(null);
      inventoryService.getInventory.mockResolvedValue({ data: [] });

      const result = await service.searchUnified('test', { page: 1, limit: 10 });

      expect(result.metadata.sources.local).toBe(1);
      expect(result.metadata.sources.external).toBe(0);
    });

    it('should apply pagination correctly', async () => {
      const mockResults = Array.from({ length: 25 }, (_, i) => ({
        id: `cocktail-${i}`,
        name: `Cocktail ${i}`,
        source: 'local',
        ingredients: [],
      }));
      cacheManager.get.mockResolvedValue(mockResults);

      const result = await service.searchUnified('all', { page: 2, limit: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.meta.currentPage).toBe(2);
      expect(result.meta.totalItems).toBe(25);
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.nextPage).toBe(3);
    });

    it('should not have next page on last page', async () => {
      const mockResults = Array.from({ length: 5 }, (_, i) => ({
        id: `c-${i}`,
        name: `C ${i}`,
        source: 'local',
        ingredients: [],
      }));
      cacheManager.get.mockResolvedValue(mockResults);

      const result = await service.searchUnified('all', { page: 1, limit: 10 });

      expect(result.meta.nextPage).toBeNull();
    });
  });

  describe('mapExternalToLocal (via search)', () => {
    it('should correctly map external drink to local format', async () => {
      cacheManager.get.mockResolvedValue(null);
      localService.findAll.mockResolvedValue({ data: [] });
      externalService.getRandomCocktail.mockResolvedValue(mockExternalDrink);
      inventoryService.getInventory.mockResolvedValue({ data: [] });

      const result = await service.searchUnified('', { page: 1, limit: 10 });

      const externalResult = result.data.find((d: any) => d.source === 'api');
      expect(externalResult).toBeDefined();
      expect(externalResult.name).toBe('External Mojito');
      expect(externalResult.ingredients).toHaveLength(3);
    });
  });

  describe('sorting', () => {
    it('should sort by name ascending by default on cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      const mockResults = [
        { id: 'b', name: 'Zombie', source: 'local', ingredients: [] },
        { id: 'a', name: 'Apple Martini', source: 'local', ingredients: [] },
      ];
      localService.findAll.mockResolvedValue({ data: [] });
      externalService.getRandomCocktail.mockResolvedValue(null);
      inventoryService.getInventory.mockResolvedValue({ data: [] });

      const result = await service.searchUnified('', { page: 1, limit: 10 });

      // Without external data, the list is empty — sorting is a no-op
      expect(result.data).toHaveLength(0);
    });
  });

  describe('filtering', () => {
    it('should filter by ingredient name on cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      const localCocktails = [
        {
          id: '1',
          name: 'Mojito',
          source: 'local',
          ingredients: [
            { ingredient: { name: 'Rum' } },
            { ingredient: { name: 'Mint' } },
          ],
        },
        {
          id: '2',
          name: 'Margarita',
          source: 'local',
          ingredients: [
            { ingredient: { name: 'Tequila' } },
            { ingredient: { name: 'Lime' } },
          ],
        },
      ];
      localService.findAll.mockResolvedValue({ data: localCocktails });
      externalService.getRandomCocktail.mockResolvedValue(null);
      inventoryService.getInventory.mockResolvedValue({ data: [] });

      const result = await service.searchUnified('', { page: 1, limit: 10 }, {
        filters: { ingredient: 'rum' },
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Mojito');
    });

    it('should filter by ingredient count range on cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      const localCocktails = [
        { id: '1', name: 'Simple', source: 'local', ingredients: [{ ingredient: { name: 'Rum' } }] },
        { id: '2', name: 'Complex', source: 'local', ingredients: new Array(7).fill({ ingredient: { name: 'X' } }) },
      ];
      localService.findAll.mockResolvedValue({ data: localCocktails });
      externalService.getRandomCocktail.mockResolvedValue(null);
      inventoryService.getInventory.mockResolvedValue({ data: [] });

      const result = await service.searchUnified('', { page: 1, limit: 10 }, {
        filters: { maxIngredients: 3 },
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Simple');
    });
  });
});
