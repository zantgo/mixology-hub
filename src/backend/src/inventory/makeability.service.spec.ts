import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Decimal } from 'decimal.js';
import { MakeabilityService } from './makeability.service';
import { BarInventoryService } from './bar-inventory.service';
import { CocktailsService } from '../cocktails/cocktails.service';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';
import { UnitConverterService } from '../utils/unit-converter.service';

describe('MakeabilityService', () => {
  let service: MakeabilityService;
  let inventoryService: any;
  let cocktailsService: any;
  let hierarchicalService: any;
  let unitConverter: any;
  let cacheManager: any;

  const mockInventoryItem = (name: string, qty: number, id?: string) => ({
    ingredient: { id: id || `ing-${name}`, name, baseUnit: 'ml', density: 1.0 },
    quantity: new Decimal(qty),
  });

  const mockCocktail = (name: string, ingredients: any[]) => ({
    id: `cock-${name}`,
    name,
    source: 'local',
    ingredients,
  });

  beforeEach(async () => {
    inventoryService = { getInventory: jest.fn() };
    cocktailsService = { findAll: jest.fn() };
    hierarchicalService = { findBestMatch: jest.fn().mockResolvedValue(null) };
    unitConverter = {
      convert: jest.fn((amount) => new Decimal(amount).times(1)),
    };
    cacheManager = { get: jest.fn(), set: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MakeabilityService,
        { provide: BarInventoryService, useValue: inventoryService },
        { provide: CocktailsService, useValue: cocktailsService },
        {
          provide: HierarchicalIngredientService,
          useValue: hierarchicalService,
        },
        { provide: UnitConverterService, useValue: unitConverter },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<MakeabilityService>(MakeabilityService);
  });

  describe('getMakeableCocktails', () => {
    it('should return cached results when available', async () => {
      cacheManager.get.mockResolvedValue({
        data: [{ name: 'Cached' }],
        meta: {},
      });

      const result = await service.getMakeableCocktails({ page: 1, limit: 10 });

      expect(result.data).toEqual([{ name: 'Cached' }]);
      expect(inventoryService.getInventory).not.toHaveBeenCalled();
    });

    it('should mark cocktails with all ingredients as makeable', async () => {
      cacheManager.get.mockResolvedValue(null);
      inventoryService.getInventory.mockResolvedValue({
        data: [mockInventoryItem('Vodka', 500), mockInventoryItem('Lime', 300)],
      });
      cocktailsService.findAll.mockResolvedValue({
        data: [
          mockCocktail('Vodka Lime', [
            {
              ingredient: { id: 'ing-Vodka', name: 'Vodka', baseUnit: 'ml' },
              amount: 50,
              unit: 'ml',
            },
            {
              ingredient: { id: 'ing-Lime', name: 'Lime', baseUnit: 'ml' },
              amount: 30,
              unit: 'ml',
            },
          ]),
        ],
      });

      const result = await service.getMakeableCocktails({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].makeability).toBe('makeable');
      expect(result.data[0].matchScore).toBe(1);
    });

    it('should mark cocktails with missing ingredients as unmakeable', async () => {
      cacheManager.get.mockResolvedValue(null);
      inventoryService.getInventory.mockResolvedValue({
        data: [mockInventoryItem('Vodka', 500)],
      });
      cocktailsService.findAll.mockResolvedValue({
        data: [
          mockCocktail('Vodka Martini', [
            {
              ingredient: { id: 'ing-Vodka', name: 'Vodka', baseUnit: 'ml' },
              amount: 50,
              unit: 'ml',
            },
            {
              ingredient: {
                id: 'ing-Vermouth',
                name: 'Vermouth',
                baseUnit: 'ml',
              },
              amount: 10,
              unit: 'ml',
            },
          ]),
        ],
      });

      const result = await service.getMakeableCocktails({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].makeability).toBe('almost');
      expect(result.data[0].matchScore).toBe(0.5);
    });

    it('should mark cocktails with insufficient stock as not returned', async () => {
      cacheManager.get.mockResolvedValue(null);
      inventoryService.getInventory.mockResolvedValue({
        data: [mockInventoryItem('Vodka', 10)],
      });
      cocktailsService.findAll.mockResolvedValue({
        data: [
          mockCocktail('Big Vodka', [
            {
              ingredient: { id: 'ing-Vodka', name: 'Vodka', baseUnit: 'ml' },
              amount: 50,
              unit: 'ml',
            },
          ]),
        ],
      });
      unitConverter.convert.mockReturnValue(new Decimal(50));

      const result = await service.getMakeableCocktails({ page: 1, limit: 10 });

      // Unmakeable cocktails are excluded from the makeable list
      expect(result.data).toHaveLength(0);
    });

    it('should handle cocktails with no ingredients (excluded from makeable)', async () => {
      cacheManager.get.mockResolvedValue(null);
      inventoryService.getInventory.mockResolvedValue({ data: [] });
      cocktailsService.findAll.mockResolvedValue({
        data: [mockCocktail('Empty', [])],
      });

      const result = await service.getMakeableCocktails({ page: 1, limit: 10 });

      // Cocktails with no ingredients are unmakeable (NaN score), excluded from results
      expect(result.data).toHaveLength(0);
    });

    it('should use unit conversion when comparing quantities', async () => {
      cacheManager.get.mockResolvedValue(null);
      inventoryService.getInventory.mockResolvedValue({
        data: [mockInventoryItem('Vodka', 100)],
      });
      cocktailsService.findAll.mockResolvedValue({
        data: [
          mockCocktail('Vodka', [
            {
              ingredient: { id: 'ing-Vodka', name: 'Vodka', baseUnit: 'ml' },
              amount: 2,
              unit: 'oz',
            },
          ]),
        ],
      });
      unitConverter.convert.mockReturnValue(new Decimal(59.14));

      const result = await service.getMakeableCocktails({ page: 1, limit: 10 });

      expect(result.data[0].makeability).toBe('makeable');
    });

    it('should handle part-based measurements with 30ml part size', async () => {
      cacheManager.get.mockResolvedValue(null);
      inventoryService.getInventory.mockResolvedValue({
        data: [
          mockInventoryItem('Vodka', 100),
          mockInventoryItem('Lime Juice', 50),
        ],
      });
      cocktailsService.findAll.mockResolvedValue({
        data: [
          mockCocktail('Part Cocktail', [
            {
              ingredient: { id: 'ing-Vodka', name: 'Vodka', baseUnit: 'ml' },
              amount: 2,
              unit: 'parts',
            },
            {
              ingredient: {
                id: 'ing-Lime Juice',
                name: 'Lime Juice',
                baseUnit: 'ml',
              },
              amount: 1,
              unit: 'part',
            },
          ]),
        ],
      });
      unitConverter.convert.mockImplementation((amount: Decimal) => amount);

      const result = await service.getMakeableCocktails({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].makeability).toBe('makeable');
      expect(result.data[0].matchScore).toBe(1);
    });

    it('should respect MAX_ITERATIONS cap', async () => {
      cacheManager.get.mockResolvedValue(null);
      inventoryService.getInventory.mockResolvedValue({ data: [] });
      const manyCocktails = Array.from({ length: 250 }, (_, i) =>
        mockCocktail(`Cocktail ${i}`, []),
      );
      cocktailsService.findAll.mockResolvedValue({ data: manyCocktails });

      const result = await service.getMakeableCocktails({ page: 1, limit: 10 });

      const meta = result.meta;
      expect(meta.warning).toBeTruthy();
      expect(meta.iterations).toBeLessThanOrEqual(200);
    });
  });
});
