# Inventory Management Tests

**Example TDD for `MeasureParserService` (Recurring Decimal Edge Case):**
```typescript
// Test recurring decimals and database precision
describe('MeasureParserService - recurring decimals', () => {
  it('should parse "1/3 oz" and round to 4 decimal places', () => {
    const parser = new MeasureParserService();
    const result = parser.parseMeasure('1/3 oz');
    // 1/3 = 0.333333... → rounded to 0.3333 for decimal(10,4)
    expect(result.amount).toBeCloseTo(0.3333, 4);
    expect(result.unit).toBe('oz');
  });

  it('should parse "2/3 oz" and round to 4 decimal places', () => {
    const parser = new MeasureParserService();
    const result = parser.parseMeasure('2/3 oz');
    // 2/3 = 0.666666... → rounded to 0.6667 for decimal(10,4)
    expect(result.amount).toBeCloseTo(0.6667, 4);
    expect(result.unit).toBe('oz');
  });

  it('should parse "1 1/2 oz" as 1.5', () => {
    const parser = new MeasureParserService();
    const result = parser.parseMeasure('1 1/2 oz');
    expect(result.amount).toBe(1.5);
    expect(result.unit).toBe('oz');
  });
});
```

**Example TDD for Zero Inventory Management (UC 1.4):**
```typescript
describe('Inventory Service - Zero Quantity Handling', () => {
  it('should handle inventory depletion to zero', async () => {
    const inventoryService = new UserInventoryService();
    const Decimal = require('decimal.js');
    
    // Mock starting with 50ml (using decimal.js)
    jest.spyOn(inventoryService, 'getInventoryQuantity')
      .mockResolvedValue(new Decimal('50'));
    
    // Prepare drink requiring 50ml (exact amount)
    await inventoryService.prepareCocktail('cocktail123', new Decimal('50'));
    
    // Verify inventory is now 0 (row must be preserved for Shopping List UX)
    const remaining = await inventoryService.getInventoryQuantity('user123', 'vodka');
    
    // Business rule: row must be preserved with quantity = 0 (UC 1.4)
    expect(remaining).toBeDefined();
    expect(remaining.equals(new Decimal('0'))).toBe(true);
  });

  it('should not show cocktails requiring depleted ingredients', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Mock user has 0ml of vodka
    jest.spyOn(makeableService, 'getUserInventory')
      .mockResolvedValue([{ ingredientId: 'vodka', quantity: new Decimal('0') }]);
    
    const makeable = await makeableService.getMakeableCocktails('user123');
    const vodkaCocktails = makeable.filter(c => 
      c.ingredients.some(i => i.ingredient.name === 'vodka')
    );
    
    expect(vodkaCocktails).toHaveLength(0);
  });
});
```

**Example TDD for Base Unit Normalization (UC 1.5):**
```typescript
describe('UnitConverterService - Base Unit Normalization', () => {
  it('should normalize all volume inputs to milliliters', () => {
    const converter = new UnitConverterService();
    
    // Test various volume units
    expect(converter.normalizeToBaseUnit(1, 'L')).toBe(1000); // Liter to ml
    expect(converter.normalizeToBaseUnit(1, 'oz')).toBeCloseTo(29.5735, 2); // Ounce to ml
    expect(converter.normalizeToBaseUnit(1, 'cl')).toBe(10); // Centiliter to ml
    expect(converter.normalizeToBaseUnit(1, 'ml')).toBe(1); // Milliliter stays ml
  });

  it('should throw error for unsupported units', () => {
    const converter = new UnitConverterService();
    
    expect(() => converter.normalizeToBaseUnit(1, 'gallon'))
      .toThrow('Unsupported unit for normalization: gallon');
  });
});
```

**Example TDD for Ingredient Name Normalization (UC 1.9):**
```typescript
describe('IngredientService - Name Normalization', () => {
  it('should normalize ingredient names to prevent duplicates', () => {
    const ingredientService = new IngredientService();
    
    const normalized = ingredientService.normalizeName('  vOdKa  ');
    expect(normalized).toBe('vodka'); // Lowercase, trimmed
    
    const normalized2 = ingredientService.normalizeName('Triple Sec');
    expect(normalized2).toBe('triple sec'); // Lowercase
    
    const normalized3 = ingredientService.normalizeName('LIME JUICE');
    expect(normalized3).toBe('lime juice');
  });

  it('should find existing ingredients by normalized name', async () => {
    const ingredientService = new IngredientService();
    const mockRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'vodka-123', name: 'Vodka' })
    };
    
    ingredientService.ingredientRepo = mockRepo;
    
    const result = await ingredientService.findOrCreate('  VODKA  ');
    
    // Should find existing vodka by normalized name
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { normalizedName: 'vodka' }
    });
    expect(result.id).toBe('vodka-123'); // Returns existing record
  });
});
```

**Example TDD for Inventory Read with Joins (UC 1.7):**
```typescript
describe('UserInventoryService - Inventory Read with Joins', () => {
  it('should return inventory with hydrated ingredient details', async () => {
    const inventoryService = new UserInventoryService();
    
    const mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            quantity: new Decimal('500'),
            ingredient: {
              id: 'vodka',
              name: 'Vodka',
              category: 'spirit',

            }
          }
        ])
      })
    };
    
    inventoryService.inventoryRepo = mockRepo;
    
    const result = await inventoryService.getUserInventoryWithDetails('user123');
    
    expect(result).toHaveLength(1);
    expect(result[0].quantity.equals(new Decimal('500'))).toBe(true);
    expect(result[0]).toHaveProperty('ingredient');
    expect(result[0].ingredient).toHaveProperty('name', 'Vodka');
    expect(result[0].ingredient).toHaveProperty('category', 'spirit');
  });
});

**Example TDD for Inventory Pagination & Sorting (UC 1.12):**
```typescript
describe('UserInventoryService - Pagination & Sorting', () => {
  it('should apply page-based pagination to inventory results', async () => {
    const inventoryService = new UserInventoryService();
    const mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          Array(10).fill(null).map((_, i) => ({
            id: `item-${i}`,
            quantity: new Decimal('100'),
            ingredient: { name: `Ingredient ${i}` }
          })),
          50 // total count
        ])
      })
    };
    inventoryService.inventoryRepo = mockRepo;

    const result = await inventoryService.getPaginatedInventory('user123', {
      limit: 10,
      page: 1,
      sortBy: 'name',
      sortOrder: 'ASC'
    });

    expect(result.data).toHaveLength(10);
    expect(result.meta.totalItems).toBe(50);
    expect(result.meta.totalPages).toBe(5);
    expect(result.meta.currentPage).toBe(1);
    expect(result.meta.nextPage).toBe(2);
  });

  it('should sort inventory alphabetically by ingredient name', async () => {
    const inventoryService = new UserInventoryService();
    const mockQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0])
    };
    
    const orderBySpy = jest.spyOn(mockQueryBuilder, 'orderBy');
    jest.spyOn(inventoryService.inventoryRepo, 'createQueryBuilder')
      .mockReturnValue(mockQueryBuilder);

    await inventoryService.getPaginatedInventory('user123', {
      limit: 10,
      sortBy: 'name',
      sortOrder: 'ASC'
    });

    expect(orderBySpy).toHaveBeenCalledWith('ingredient.name', 'ASC');
  });

  it('should sort inventory by recently updated', async () => {
    const inventoryService = new UserInventoryService();
    const mockQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0])
    };
    
    const orderBySpy = jest.spyOn(mockQueryBuilder, 'orderBy');
    jest.spyOn(inventoryService.inventoryRepo, 'createQueryBuilder')
      .mockReturnValue(mockQueryBuilder);

    await inventoryService.getPaginatedInventory('user123', {
      limit: 10,
      sortBy: 'updated_at',
      sortOrder: 'DESC'
    });

    expect(orderBySpy).toHaveBeenCalledWith('inventory.updated_at', 'DESC');
  });
});
```

**Example TDD for Upper Boundary / Overflow Prevention (UC 1.13):**
```typescript
describe('Inventory Validation - Boundaries', () => {
  it('should reject astronomically large inventory additions', async () => {
    const inventoryService = new UserInventoryService();
    
    const payload = { ingredientId: 'vodka-123', quantity: new Decimal('999999999'), unit: 'ml' };
    
    await expect(inventoryService.addToInventory('user123', payload))
      .rejects
      .toThrow('Quantity must not exceed 100000');
  });

  it('should accept quantities at the maximum boundary', async () => {
    const inventoryService = new UserInventoryService();
    const mockRepo = { save: jest.fn().mockResolvedValue(true) };
    inventoryService.inventoryRepo = mockRepo;
    
    const payload = { ingredientId: 'vodka-123', quantity: new Decimal('100000'), unit: 'ml' };
    
    await expect(inventoryService.addToInventory('user123', payload)).resolves.not.toThrow();
  });

  it('should prevent decimal overflow in database operations', async () => {
    const inventoryService = new UserInventoryService();
    
    // Test with value that would overflow decimal(10,4)
    const overflowPayload = { ingredientId: 'vodka-123', quantity: new Decimal('999999999.99'), unit: 'ml' };
    
    await expect(inventoryService.addToInventory('user123', overflowPayload))
      .rejects
      .toThrow('Quantity exceeds database precision limits');
  });
});
```



**Example TDD for Adding "Count-Based" or Qualitative Inventory Items (UC 1.14):**
```typescript
describe('UnitConverterService - Count-Based Units', () => {
  it('should recognize "piece", "whole", "count" as base count units', () => {
    const converter = new UnitConverterService();
    
    expect(converter.isCountUnit('piece')).toBe(true);
    expect(converter.isCountUnit('whole')).toBe(true);
    expect(converter.isCountUnit('count')).toBe(true);
    expect(converter.isCountUnit('ml')).toBe(false);
    expect(converter.isCountUnit('g')).toBe(false);
  });

  it('should handle count-based unit conversions linearly', () => {
    const converter = new UnitConverterService();
    
    // Count units convert 1:1
    expect(converter.convert(5, 'piece', 'piece')).toBe(5);
    expect(converter.convert(2.5, 'whole', 'piece')).toBe(2.5);
    
    // Cannot convert count to volume/mass
    expect(() => converter.convert(1, 'piece', 'ml'))
      .toThrow('Cannot convert count unit to volume unit');
    expect(() => converter.convert(1, 'piece', 'g'))
      .toThrow('Cannot convert count unit to mass unit');
  });

  it('should allow fractional count values for partial items', () => {
    const converter = new UnitConverterService();
    
    // Half a lemon
    expect(converter.convert(0.5, 'piece', 'piece')).toBe(0.5);
    
    // Three and a half mint sprigs
    expect(converter.convert(3.5, 'whole', 'piece')).toBe(3.5);
  });
});

describe('Inventory Service - Count-Based Inventory Management', () => {
  it('should add count-based items to inventory without volume conversion', async () => {
    const inventoryService = new UserInventoryService();
    
    const payload = {
      ingredientId: 'lemon-123',
      quantity: new Decimal('3'),
      unit: 'piece'
    };
    
    jest.spyOn(inventoryService, 'validateInventoryPayload').mockReturnValue(true);
    const mockSave = jest.spyOn(inventoryService.inventoryRepo, 'save');
    
    await inventoryService.addToInventory('user123', payload);
    
    // Should save with count unit, not attempt to convert to ml
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      quantity: new Decimal('3'),
      unit: 'piece',
      baseUnit: 'count'
    }));
  });

  it('should deduct count-based items linearly during preparation', async () => {
    const inventoryService = new UserInventoryService();
    const Decimal = require('decimal.js');
    
    // User has 5 lemons (using decimal.js)
    jest.spyOn(inventoryService, 'getInventoryQuantity')
      .mockResolvedValue(new Decimal('5'));
    
    // Cocktail requires 0.5 lemons (half a lemon) using decimal.js
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    
    await inventoryService.prepareCocktail('lemon_drop_id', new Decimal('0.5'), 'piece');
    
    expect(mockDeduct).toHaveBeenCalledWith('user123', 'lemon-123', new Decimal('0.5'));
  });

  it('should handle count-based ingredients in makeability calculations', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail requires 2 mint sprigs (count-based)
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'mint_sprig', amount: new Decimal('2'), unit: 'piece', baseUnit: 'count' }
    ]);
    
    // User has 3 mint sprigs
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'mint_sprig', quantity: new Decimal('3'), unit: 'piece' }
    ]);
    
    const result = await makeableService.checkMakeable('mojito_id', 1);
    
    expect(result.isMakeable).toBe(true);
    expect(result.requiredAmounts[0].amount).toBe(2);
    expect(result.requiredAmounts[0].unit).toBe('piece');
  });

  it('should prevent mixing count and volume units in calculations', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail requires 1 lemon (piece) and 50ml lime juice
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'lemon', amount: new Decimal('1'), unit: 'piece', baseUnit: 'count' },
      { ingredientId: 'lime_juice', amount: new Decimal('50'), unit: 'ml', baseUnit: 'volume' }
    ]);
    
    // User has both
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'lemon', quantity: new Decimal('2'), unit: 'piece' },
      { ingredientId: 'lime_juice', quantity: new Decimal('100'), unit: 'ml' }
    ]);
    
    const result = await makeableService.checkMakeable('lemon_lime_id', 1);
    
    // Should handle both unit types correctly
    expect(result.isMakeable).toBe(true);
    expect(result.requiredAmounts).toHaveLength(2);
  });
});

**Example TDD for Inventory Row Limits (UC 1.15):**
```typescript
describe('Inventory Service - Row Limits', () => {
  it('should prevent adding more than maximum distinct ingredients', async () => {
    const inventoryService = new UserInventoryService();
    
    // Mock user already has 10,000 inventory items
    jest.spyOn(inventoryService.inventoryRepo, 'count').mockResolvedValue(10000);
    
    const payload = {
      ingredientId: 'ingredient-10001',
      quantity: new Decimal('100'),
      unit: 'ml'
    };
    
    await expect(inventoryService.addToInventory('user123', payload))
      .rejects
      .toThrow('Maximum inventory limit reached (10,000 distinct ingredients)');
  });

  it('should allow adding up to the maximum limit', async () => {
    const inventoryService = new UserInventoryService();
    
    // Mock user has 9,999 items (just below limit)
    jest.spyOn(inventoryService.inventoryRepo, 'count').mockResolvedValue(9999);
    jest.spyOn(inventoryService.inventoryRepo, 'save').mockResolvedValue({} as any);
    
    const payload = {
      ingredientId: 'ingredient-10000',
      quantity: new Decimal('100'),
      unit: 'ml'
    };
    
    await expect(inventoryService.addToInventory('user123', payload)).resolves.not.toThrow();
  });

  it('should not count duplicate ingredient updates against limit', async () => {
    const inventoryService = new UserInventoryService();
    
    // Mock user has 9,999 items
    jest.spyOn(inventoryService.inventoryRepo, 'count').mockResolvedValue(9999);
    
    // Mock that ingredient already exists (update, not new)
    jest.spyOn(inventoryService.inventoryRepo, 'findOne').mockResolvedValue({
      id: 'existing-item',
      ingredientId: 'vodka-123',
      quantity: new Decimal('500')
    });
    
    const payload = {
      ingredientId: 'vodka-123', // Already exists
      quantity: new Decimal('600'),
      unit: 'ml'
    };
    
    // Should allow update even at limit
    await expect(inventoryService.addToInventory('user123', payload)).resolves.not.toThrow();
  });

  it('should return 422 Unprocessable Entity for limit violations', async () => {
    const inventoryService = new UserInventoryService();
    
    jest.spyOn(inventoryService.inventoryRepo, 'count').mockResolvedValue(10001);
    
    const payload = { ingredientId: 'test', quantity: new Decimal('1'), unit: 'ml' };
    
    try {
      await inventoryService.addToInventory('user123', payload);
    } catch (error) {
      expect(error.statusCode).toBe(422);
      expect(error.message).toContain('Maximum inventory limit reached');
    }
  });

  it('should apply limits per user, not globally', async () => {
    const inventoryService = new UserInventoryService();
    
    // User A has 10,000 items
    jest.spyOn(inventoryService.inventoryRepo, 'count')
      .mockImplementation(async (options) => {
        if (options.where.userId === 'userA') return 10000;
        if (options.where.userId === 'userB') return 5000;
        return 0;
      });
    
    const payload = { ingredientId: 'new-ingredient', quantity: new Decimal('1'), unit: 'ml' };
    
    // User A should be blocked
    await expect(inventoryService.addToInventory('userA', payload))
      .rejects
      .toThrow('Maximum inventory limit reached');
    
    // User B should be allowed
    jest.spyOn(inventoryService.inventoryRepo, 'save').mockResolvedValue({} as any);
    await expect(inventoryService.addToInventory('userB', payload)).resolves.not.toThrow();
  });

  it('should provide informative error message with limit details', async () => {
    const inventoryService = new UserInventoryService();
    
    jest.spyOn(inventoryService.inventoryRepo, 'count').mockResolvedValue(10000);
    
    const payload = { ingredientId: 'test', quantity: new Decimal('1'), unit: 'ml' };
    
    try {
      await inventoryService.addToInventory('user123', payload);
    } catch (error) {
      expect(error.message).toContain('10,000');
      expect(error.message).toContain('distinct ingredients');
      expect(error.message).toContain('consider removing unused items');
    }
  });

  it('should exclude soft-deleted items from limit count', async () => {
    const inventoryService = new UserInventoryService();
    
    // Mock count query that excludes deleted items
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(9999)
    };
    
    jest.spyOn(inventoryService.inventoryRepo, 'createQueryBuilder')
      .mockReturnValue(mockQueryBuilder as any);
    
    // Verify query excludes deleted items
    await inventoryService.checkInventoryLimit('user123');
    
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('inventory.is_deleted = :isDeleted', {
      isDeleted: false
    });
  });
});
```

**Example TDD for Inventory Addition Unit Validation (UC 1.17):**
```typescript
describe('Inventory Service - Unit Type Validation', () => {
  it('should reject incompatible unit types during inventory addition', async () => {
    const inventoryService = new UserInventoryService();
    const ingredientService = new IngredientService();
    
    // Mock ingredient with volume base unit
    jest.spyOn(ingredientService, 'getIngredientById').mockResolvedValue({
      id: 'vodka-123',
      name: 'Vodka',
      baseUnit: 'ml',
      unitType: 'volume'
    });
    
    inventoryService.ingredientService = ingredientService;
    
    // Attempt to add vodka with count unit (incompatible)
    const invalidPayload = { ingredientId: 'vodka-123', quantity: new Decimal('1'), unit: 'slice' };
    
    await expect(inventoryService.addToInventory('user123', invalidPayload))
      .rejects
      .toThrow('Incompatible unit type: Vodka requires volume units (ml, oz, L), not count units (slice)');
  });

  it('should accept compatible unit types during inventory addition', async () => {
    const inventoryService = new UserInventoryService();
    const ingredientService = new IngredientService();
    
    // Mock ingredient with volume base unit
    jest.spyOn(ingredientService, 'getIngredientById').mockResolvedValue({
      id: 'vodka-123',
      name: 'Vodka',
      baseUnit: 'ml',
      unitType: 'volume'
    });
    
    inventoryService.ingredientService = ingredientService;
    
    // Valid volume units for vodka
    const validPayloads = [
      { ingredientId: 'vodka-123', quantity: new Decimal('500'), unit: 'ml' },
      { ingredientId: 'vodka-123', quantity: new Decimal('16.9'), unit: 'oz' },
      { ingredientId: 'vodka-123', quantity: new Decimal('1'), unit: 'L' }
    ];
    
    for (const payload of validPayloads) {
      await expect(inventoryService.addToInventory('user123', payload)).resolves.not.toThrow();
    }
  });

  it('should validate unit compatibility across all unit types', async () => {
    const inventoryService = new UserInventoryService();
    const ingredientService = new IngredientService();
    
    // Test different ingredient types
    const testCases = [
      {
        ingredient: { id: 'lemon-123', name: 'Lemon', baseUnit: 'piece', unitType: 'count' },
        validUnits: ['piece', 'whole', 'count'],
        invalidUnits: ['ml', 'oz', 'g']
      },
      {
        ingredient: { id: 'salt-123', name: 'Salt', baseUnit: 'g', unitType: 'mass' },
        validUnits: ['g', 'kg', 'oz'],
        invalidUnits: ['ml', 'piece', 'slice']
      },
      {
        ingredient: { id: 'simple_syrup-123', name: 'Simple Syrup', baseUnit: 'ml', unitType: 'volume' },
        validUnits: ['ml', 'oz', 'L', 'dash', 'tsp'],
        invalidUnits: ['piece', 'g', 'slice']
      }
    ];
    
    for (const testCase of testCases) {
      jest.spyOn(ingredientService, 'getIngredientById').mockResolvedValue(testCase.ingredient);
      inventoryService.ingredientService = ingredientService;
      
      // Test valid units
      for (const unit of testCase.validUnits) {
        const payload = { ingredientId: testCase.ingredient.id, quantity: new Decimal('1'), unit };
        await expect(inventoryService.addToInventory('user123', payload)).resolves.not.toThrow();
      }
      
      // Test invalid units
      for (const unit of testCase.invalidUnits) {
        const payload = { ingredientId: testCase.ingredient.id, quantity: new Decimal('1'), unit };
        await expect(inventoryService.addToInventory('user123', payload))
          .rejects
          .toThrow(`Incompatible unit type: ${testCase.ingredient.name} requires ${testCase.ingredient.unitType} units`);
      }
    }
  });

  it('should handle unit conversion within compatible types', async () => {
    const inventoryService = new UserInventoryService();
    const ingredientService = new IngredientService();
    const unitConverter = new UnitConverterService();
    
    // Mock ingredient with volume base unit
    jest.spyOn(ingredientService, 'getIngredientById').mockResolvedValue({
      id: 'vodka-123',
      name: 'Vodka',
      baseUnit: 'ml',
      unitType: 'volume'
    });
    
    // Mock unit converter
    jest.spyOn(unitConverter, 'convert').mockReturnValue(29.5735); // 1 oz = 29.5735 ml
    jest.spyOn(unitConverter, 'areUnitsCompatible').mockReturnValue(true);
    
    inventoryService.ingredientService = ingredientService;
    inventoryService.unitConverter = unitConverter;
    
    // Add vodka in ounces (should convert to ml for storage)
    const payload = { ingredientId: 'vodka-123', quantity: new Decimal('1'), unit: 'oz' };
    
    await inventoryService.addToInventory('user123', payload);
    
    // Should call converter to convert oz to ml
    expect(unitConverter.convert).toHaveBeenCalledWith(1, 'oz', 'ml');
    expect(unitConverter.areUnitsCompatible).toHaveBeenCalledWith('oz', 'ml');
  });

  it('should reject unit conversion attempts between incompatible types', async () => {
    const inventoryService = new UserInventoryService();
    const ingredientService = new IngredientService();
    const unitConverter = new UnitConverterService();
    
    // Mock ingredient with volume base unit
    jest.spyOn(ingredientService, 'getIngredientById').mockResolvedValue({
      id: 'vodka-123',
      name: 'Vodka',
      baseUnit: 'ml',
      unitType: 'volume'
    });
    
    // Mock unit converter to detect incompatibility
    jest.spyOn(unitConverter, 'areUnitsCompatible').mockReturnValue(false);
    
    inventoryService.ingredientService = ingredientService;
    inventoryService.unitConverter = unitConverter;
    
    // Attempt to add vodka with mass unit (incompatible)
    const payload = { ingredientId: 'vodka-123', quantity: new Decimal('500'), unit: 'g' };
    
    await expect(inventoryService.addToInventory('user123', payload))
      .rejects
      .toThrow('Incompatible unit type');
    
    expect(unitConverter.areUnitsCompatible).toHaveBeenCalledWith('g', 'ml');
  });

  it('should provide user-friendly error messages for unit validation failures', async () => {
    const inventoryService = new UserInventoryService();
    const ingredientService = new IngredientService();
    
    jest.spyOn(ingredientService, 'getIngredientById').mockResolvedValue({
      id: 'gin-123',
      name: 'Gin',
      baseUnit: 'ml',
      unitType: 'volume',
      suggestedUnits: ['ml', 'oz', 'dash', 'tsp']
    });
    
    inventoryService.ingredientService = ingredientService;
    
    const payload = { ingredientId: 'gin-123', quantity: new Decimal('2'), unit: 'slice' };
    
    try {
      await inventoryService.addToInventory('user123', payload);
    } catch (error) {
      expect(error.message).toContain('Gin requires volume units');
      expect(error.message).toContain('Suggested units: ml, oz, dash, tsp');
      expect(error.statusCode).toBe(400);
    }
  });
});
```

**Example TDD for IngredientService - Immutability (UC 1.19):**
```typescript
describe('IngredientService - Immutability', () => {
  it('should prevent changing baseUnit if ingredient is in use', async () => {
    const ingredientService = new IngredientService();
    
    // Mock that the ingredient is actively mapped in cocktail_ingredients
    jest.spyOn(ingredientService.cocktailIngredientRepo, 'count').mockResolvedValue(5);
    
    await expect(ingredientService.updateIngredient('ing-123', { baseUnit: 'g' }))
      .rejects
      .toThrow('Conflict: Cannot change baseUnit because ingredient is currently used in 5 recipes.');
  });

  it('should allow changing baseUnit for unused ingredients', async () => {
    const ingredientService = new IngredientService();
    
    // Mock ingredient not used in any recipes
    jest.spyOn(ingredientService.cocktailIngredientRepo, 'count').mockResolvedValue(0);
    jest.spyOn(ingredientService.inventoryRepo, 'count').mockResolvedValue(0);
    
    const mockSave = jest.spyOn(ingredientService.ingredientRepo, 'save').mockResolvedValue({} as any);
    
    await ingredientService.updateIngredient('ing-123', { baseUnit: 'ml' });
    
    expect(mockSave).toHaveBeenCalled();
  });

  it('should check both cocktail usage and inventory usage', async () => {
    const ingredientService = new IngredientService();
    
    // Mock ingredient used in 2 cocktails and 3 inventory entries
    jest.spyOn(ingredientService.cocktailIngredientRepo, 'count').mockResolvedValue(2);
    jest.spyOn(ingredientService.inventoryRepo, 'count').mockResolvedValue(3);
    
    await expect(ingredientService.updateIngredient('ing-123', { baseUnit: 'count' }))
      .rejects
      .toThrow('Conflict: Cannot change baseUnit because ingredient is currently used in 2 recipes and 3 inventory entries.');
  });

  it('should allow updating other fields even when baseUnit is locked', async () => {
    const ingredientService = new IngredientService();
    
    // Mock ingredient is in use
    jest.spyOn(ingredientService.cocktailIngredientRepo, 'count').mockResolvedValue(3);
    
    const mockSave = jest.spyOn(ingredientService.ingredientRepo, 'save').mockResolvedValue({} as any);
    
    // Should allow updating description even if baseUnit is locked
    await ingredientService.updateIngredient('ing-123', { 
      description: 'Updated description',
      category: 'Updated category'
      // No baseUnit change
    });
    
    expect(mockSave).toHaveBeenCalled();
  });

  it('should validate baseUnit compatibility before allowing change', async () => {
    const ingredientService = new IngredientService();
    
    // Mock ingredient not in use
    jest.spyOn(ingredientService.cocktailIngredientRepo, 'count').mockResolvedValue(0);
    jest.spyOn(ingredientService.inventoryRepo, 'count').mockResolvedValue(0);
    
    // Mock unit converter to validate compatibility
    const unitConverter = new UnitConverterService();
    jest.spyOn(unitConverter, 'canConvertBetween').mockReturnValue(false);
    
    ingredientService.unitConverter = unitConverter;
    
    // Attempt to change from volume to count (incompatible)
    await expect(ingredientService.updateIngredient('ing-123', { baseUnit: 'count' }))
      .rejects
      .toThrow('Cannot change baseUnit from volume to count - incompatible unit types');
  });

  it('should handle batch update of multiple ingredients with baseUnit validation', async () => {
    const ingredientService = new IngredientService();
    
    // Mock some ingredients are in use, some are not
    const countSpy = jest.spyOn(ingredientService.cocktailIngredientRepo, 'count')
      .mockImplementation(async (options) => {
        const ingredientId = options.where.ingredientId;
        if (ingredientId === 'used-ingredient') return 5;
        if (ingredientId === 'unused-ingredient') return 0;
        return 0;
      });
    
    const updates = [
      { id: 'used-ingredient', baseUnit: 'ml' }, // Should fail
      { id: 'unused-ingredient', baseUnit: 'g' }  // Should succeed
    ];
    
    await expect(ingredientService.batchUpdateIngredients(updates))
      .rejects
      .toThrow('Conflict: Cannot change baseUnit for used-ingredient');
    
    expect(countSpy).toHaveBeenCalledTimes(2);
  });

  it('should provide detailed error information for debugging', async () => {
    const ingredientService = new IngredientService();
    
    jest.spyOn(ingredientService.cocktailIngredientRepo, 'count').mockResolvedValue(8);
    
    try {
      await ingredientService.updateIngredient('ing-123', { baseUnit: 'piece' });
    } catch (error) {
      expect(error.statusCode).toBe(409);
      expect(error.message).toContain('Cannot change baseUnit');
      expect(error.message).toContain('8 recipes');
      expect(error.details).toHaveProperty('ingredientId', 'ing-123');
      expect(error.details).toHaveProperty('currentUsageCount', 8);
    }
  });

  it('should work with transaction rollback on validation failure', async () => {
    const ingredientService = new IngredientService();
    
    // Mock transaction
    const mockTransaction = jest.fn().mockImplementation(async (callback) => {
      try {
        return await callback();
      } catch (error) {
        throw error;
      }
    });
    
    jest.spyOn(ingredientService.ingredientRepo.manager, 'transaction').mockImplementation(mockTransaction);
    
    // Mock ingredient is in use
    jest.spyOn(ingredientService.cocktailIngredientRepo, 'count').mockResolvedValue(1);
    
    await expect(ingredientService.updateIngredient('ing-123', { baseUnit: 'ml' }))
      .rejects
      .toThrow();
    
    // Transaction should have been attempted and rolled back
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('should allow admin override for critical fixes', async () => {
    const ingredientService = new IngredientService();
    
    // Mock ingredient is in use
    jest.spyOn(ingredientService.cocktailIngredientRepo, 'count').mockResolvedValue(10);
    
    // Admin override with force flag
    const mockSave = jest.spyOn(ingredientService.ingredientRepo, 'save').mockResolvedValue({} as any);
    
    await ingredientService.updateIngredient('ing-123', { baseUnit: 'ml' }, true); // force = true
    
    expect(mockSave).toHaveBeenCalled();
    
    // Should log admin override
    const loggerSpy = jest.spyOn(ingredientService.logger, 'warn');
    expect(loggerSpy).toHaveBeenCalledWith(
      'Admin forced baseUnit change',
      expect.objectContaining({
        ingredientId: 'ing-123',
        oldBaseUnit: expect.any(String),
        newBaseUnit: 'ml',
        usageCount: 10
      })
    );
  });
});

describe('AdminIngredientService - Merge Ingredients', () => {
  it('should merge ingredient A into B and sum quantities if user has both', async () => {
    const adminService = new AdminIngredientService();
    
    // User123 has 100ml of "Fresh Lime" (A) and 200ml of "Lime" (B)
    jest.spyOn(adminService.inventoryRepo, 'find').mockResolvedValue([
      { userId: 'user123', ingredientId: 'A', quantity: new Decimal('100') },
      { userId: 'user123', ingredientId: 'B', quantity: new Decimal('200') }
    ]);
    
    const saveSpy = jest.spyOn(adminService.inventoryRepo, 'save');
    const deleteSpy = jest.spyOn(adminService.ingredientRepo, 'delete');
    
    await adminService.mergeIngredients('A', 'B');
    
    // Should result in a single row for User123 with 300ml of B
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user123',
      ingredientId: 'B',
      quantity: new Decimal('300')
    }));
    
    // Should delete ingredient A
    expect(deleteSpy).toHaveBeenCalledWith('A');
  });
});

**Example TDD for Decimal Math Precision on Large Batches:**
```typescript
describe('UnitConverterService - Decimal Precision for Large Batches', () => {
  it('should not lose precision when scaling fractional ingredients by massive servings', () => {
    // e.g., 0.33 oz (1/3 oz) * 10,000 servings
    // Ensure the Math engine uses precise decimal libraries (like decimal.js) 
    // instead of native JS floats to prevent rounding drifts
    
    const converter = new UnitConverterService();
    
    // Test with recurring decimal (1/3 = 0.333333...)
    const singleServing = 1/3; // 0.3333333333333333 (JavaScript float)
    const largeBatch = 10000;
    
    // Native JavaScript float multiplication (prone to rounding errors)
    const nativeResult = singleServing * largeBatch; // 3333.3333333333335
    
    // Decimal.js precise multiplication
    const Decimal = require('decimal.js');
    const preciseSingle = new Decimal(1).div(3); // 0.33333333333333333333
    const preciseResult = preciseSingle.times(largeBatch); // 3333.3333333333333333
    
    // The difference shows the rounding error
    const roundingError = Math.abs(nativeResult - preciseResult.toNumber());
    
    // JavaScript float error is about 0.0000000000005
    expect(roundingError).toBeGreaterThan(0);
    
    // Our converter should use precise math
    const converterResult = converter.scaleAmount(singleServing, largeBatch);
    
    // Should match precise result within acceptable tolerance
    expect(Math.abs(converterResult - preciseResult.toNumber())).toBeLessThan(0.0000001);
  });

  it('should handle very small fractional amounts correctly', () => {
    const converter = new UnitConverterService();
    
    // 1/64 oz (very small amount)
    const tinyAmount = 1/64; // 0.015625
    const batchSize = 1000;
    
    const result = converter.scaleAmount(tinyAmount, batchSize);
    
    // 0.015625 * 1000 = 15.625 exactly
    expect(result).toBe(15.625);
    
    // Should not be 15.624999999999998 (JavaScript float error)
    expect(result).not.toBe(15.624999999999998);
  });

  it('should maintain precision across unit conversions and scaling', () => {
    const converter = new UnitConverterService();
    
    // Convert 1/3 oz to ml, then scale by 5000
    const amountOz = 1/3; // 0.333333...
    const batchSize = 5000;
    
    // Step 1: Convert oz to ml (1 oz = 29.5735 ml)
    const amountMl = converter.convert(amountOz, 'oz', 'ml');
    
    // Step 2: Scale for batch
    const batchMl = converter.scaleAmount(amountMl, batchSize);
    
    // Expected: (1/3) * 29.5735 * 5000 = 49289.16666666667
    const expected = (1/3) * 29.5735 * 5000;
    
    // Check precision
    const error = Math.abs(batchMl - expected);
    expect(error).toBeLessThan(0.0001);
  });

  it('should use decimal.js for all mathematical operations', () => {
    const converter = new UnitConverterService();
    
    // Verify converter uses Decimal internally
    const amount = new converter.Decimal(1).div(3); // Should be Decimal instance
    expect(amount.constructor.name).toBe('Decimal');
    
    const scaled = amount.times(10000);
    expect(scaled.constructor.name).toBe('Decimal');
    
    // Convert to number for comparison
    const result = scaled.toNumber();
    
    // Should be precise
    expect(result).toBeCloseTo(3333.333333333333, 10);
  });

  it('should handle inventory aggregation with fractional amounts', async () => {
    const inventoryService = new UserInventoryService();
    
    // Mock multiple inventory entries with fractional amounts
    jest.spyOn(inventoryService.inventoryRepo, 'find').mockResolvedValue([
      { ingredientId: 'vodka', quantity: new Decimal('100.33'), unit: 'ml' },
      { ingredientId: 'vodka', quantity: new Decimal('50.67'), unit: 'ml' },
      { ingredientId: 'gin', quantity: new Decimal('75.25'), unit: 'ml' },
      { ingredientId: 'gin', quantity: new Decimal('25.75'), unit: 'ml' }
    ]);
    
    const aggregated = await inventoryService.getAggregatedInventory('user123');
    
    // Vodka: 100.33 + 50.67 = 151.00 exactly
    const vodkaEntry = aggregated.find(i => i.ingredientId === 'vodka');
    expect(vodkaEntry.quantity).toBe(151.00);
    
    // Gin: 75.25 + 25.75 = 101.00 exactly
    const ginEntry = aggregated.find(i => i.ingredientId === 'gin');
    expect(ginEntry.quantity).toBe(101.00);
    
    // Should not be 150.99999999999997 or 100.99999999999999
    expect(vodkaEntry.quantity).not.toBe(150.99999999999997);
    expect(ginEntry.quantity).not.toBe(100.99999999999999);
  });

  it('should prevent cumulative rounding errors in batch preparation', async () => {
    const preparationService = new CocktailPreparationService();
    
    // Cocktail requires 0.33 oz of vodka per serving
    const servings = 10000;
    const requiredPerServing = 1/3; // 0.333333...
    
    // Calculate total required
    const totalRequired = preparationService.calculateTotalRequired(requiredPerServing, servings);
    
    // Should be exactly 3333.3333333333335 (or precise equivalent)
    // Not 3333.333333333333 or 3333.333333333334
    const expected = (1/3) * 10000;
    
    // Check precision
    const error = Math.abs(totalRequired - expected);
    expect(error).toBeLessThan(0.000000000001);
    
    // Verify deduction uses precise math
    const mockInventory = { quantity: new Decimal('5000') };
    const remaining = preparationService.deductFromInventory(mockInventory, totalRequired);
    
    // 5000 - 3333.3333333333335 = 1666.6666666666665
    const expectedRemaining = 5000 - expected;
    const remainingError = Math.abs(remaining - expectedRemaining);
    expect(remainingError).toBeLessThan(0.000000000001);
  });

  it('should handle edge case of many small fractional deductions', async () => {
    const preparationService = new CocktailPreparationService();
    
    // Simulate preparing 1000 cocktails, each requiring 0.001 oz
    const smallAmount = 0.001;
    const manyServings = 1000;
    
    // Calculate total
    const total = preparationService.calculateTotalRequired(smallAmount, manyServings);
    
    // 0.001 * 1000 = 1.0 exactly
    expect(total).toBe(1.0);
    
    // Should not be 0.9999999999999999
    expect(total).not.toBe(0.9999999999999999);
  });

  it('should validate that database decimal columns match JavaScript precision', () => {
    // Test that PostgreSQL decimal(10,4) matches our Decimal.js precision
    
    const testValues = [
      0.0001,  // Smallest representable in decimal(10,4)
      0.3333,  // Recurring decimal
      123456.7890,  // Large with 4 decimal places
      999999.9999,  // Maximum for decimal(10,4)
      0.00005, // Should round to 0.0001
      0.00004  // Should round to 0.0000
    ];
    
    const columnTransformer = new ColumnNumericTransformer();
    
    testValues.forEach(value => {
      // Transform to database format
      const dbValue = columnTransformer.to(value);
      
      // Transform back from database
      const jsValue = columnTransformer.from(dbValue.toString());
      
      // Should match within rounding rules
      const roundedValue = Math.round(value * 100) / 100;
      expect(jsValue).toBeCloseTo(roundedValue, 2);
    });
  });
});

**Example TDD for Strict Boundary Failsafe (Part-Based Volume Bounding):**
```typescript
describe('Inventory Service - Strict Boundary Failsafe', () => {
  it('should reject part-based cocktails with astronomically large volumes', async () => {
    const preparationService = new CocktailPreparationService();
    
    // Mock cocktail with part-based recipe: 1 part vodka, 1 part lime juice
    const mockCocktail = {
      id: 'part-based-cocktail',
      recipeType: 'parts',
      ingredients: [
        { ingredientId: 'vodka', amount: new Decimal('1'), unit: 'part' },
        { ingredientId: 'lime-juice', amount: new Decimal('1'), unit: 'part' }
      ]
    };
    
    // User attempts to prepare with totalVolumeMl = 1000000 (1 million ml total)
    const totalVolumeMl = '1000000.00'; // 1000 liters total - absurdly large
    
    await expect(preparationService.prepareCocktail('user123', mockCocktail.id, 1, totalVolumeMl))
      .rejects
      .toThrow('Total volume exceeds maximum allowed (10000 ml)');
  });

  it('should enforce maximum total volume boundary', async () => {
    const preparationService = new CocktailPreparationService();
    
    // Test at the boundary
    const maxTotalVolumeMl = '10000.00'; // 10 liters total (maximum allowed)
    const boundaryTotalVolumeMl = '10001.00'; // Just over boundary
    
    const mockCocktail = {
      id: 'test-cocktail',
      recipeType: 'parts',
      ingredients: [{ ingredientId: 'vodka', amount: new Decimal('1'), unit: 'part' }]
    };
    
    // Should accept at boundary
    jest.spyOn(preparationService, 'validateTotalVolume').mockReturnValue(true);
    await expect(preparationService.prepareCocktail('user123', mockCocktail.id, 1, maxTotalVolumeMl))
      .resolves.not.toThrow();
    
    // Should reject just over boundary
    await expect(preparationService.prepareCocktail('user123', mockCocktail.id, 1, boundaryTotalVolumeMl))
      .rejects
      .toThrow('Total volume exceeds maximum allowed');
  });

  it('should prevent integer overflow attacks with large part counts', async () => {
    const preparationService = new CocktailPreparationService();
    
    // Attack scenario: 1000 parts * 10000 ml = 10,000,000 ml total
    const mockCocktail = {
      id: 'overflow-attack',
      recipeType: 'parts',
      ingredients: [
        { ingredientId: 'vodka', amount: new Decimal('1000'), unit: 'part' } // 1000 parts!
      ]
    };
    
    const totalVolumeMl = '10000.00'; // Maximum allowed total volume
    
    // Total would be 1000 * (10000 / 1000) = 10,000 ml per ingredient (10 liters!)
    // Should be rejected even though totalVolumeMl is within limit
    await expect(preparationService.prepareCocktail('user123', mockCocktail.id, 1, totalVolumeMl))
      .rejects
      .toThrow('Total volume exceeds safe limits');
  });



  it('should validate part size before any inventory operations', async () => {
    const preparationService = new CocktailPreparationService();
    
    const validateSpy = jest.spyOn(preparationService, 'validateTotalVolume');
    const inventorySpy = jest.spyOn(preparationService, 'checkInventoryAvailability');
    
    const largeTotalVolumeMl = '50000.00'; // 50 liters - should be rejected
    
    try {
      await preparationService.prepareCocktail('user123', 'cocktail-id', 1, largeTotalVolumeMl);
    } catch (error) {
      // Validation should happen BEFORE inventory check
      expect(validateSpy).toHaveBeenCalled();
      expect(inventorySpy).not.toHaveBeenCalled();
    }
  });

  it('should provide user-friendly error messages for boundary violations', async () => {
    const preparationService = new CocktailPreparationService();
    
    const testCases = [
      { totalVolumeMl: '1000000.00', expectedMessage: 'Total volume (1000.0 L) exceeds maximum allowed (10.0 L)' },
      { totalVolumeMl: '50000.00', expectedMessage: 'Total volume (50.0 L) exceeds maximum allowed (10.0 L)' },
      { totalVolumeMl: '15000.00', expectedMessage: 'Total volume (15.0 L) exceeds maximum allowed (10.0 L)' }
    ];
    
    for (const testCase of testCases) {
      try {
        await preparationService.prepareCocktail('user123', 'cocktail-id', 1, testCase.totalVolumeMl);
      } catch (error) {
        expect(error.message).toContain(testCase.expectedMessage);
        expect(error.statusCode).toBe(400);
      }
    }
  });

  it('should allow reasonable part sizes for normal use', async () => {
    const preparationService = new CocktailPreparationService();
    
    const reasonableVolumes = ['30.00', '50.00', '100.00', '500.00', '1000.00']; // 30ml to 1L total volume
    
    for (const totalVolumeMl of reasonableVolumes) {
      jest.spyOn(preparationService, 'validateTotalVolume').mockReturnValue(true);
      jest.spyOn(preparationService, 'checkInventoryAvailability').mockResolvedValue(true);
      jest.spyOn(preparationService, 'deductInventory').mockResolvedValue();
      
      await expect(preparationService.prepareCocktail('user123', 'cocktail-id', 1, totalVolumeMl))
        .resolves.not.toThrow();
    }
  });

  it('should apply boundary checks to user-provided part size in API', async () => {
    // This test simulates the API layer validation
    const cocktailController = new CocktailController();
    
    const invalidRequest = {
      cocktailId: 'part-based-cocktail',
      servings: 1,
      totalVolumeMl: "999999.00" // Absurdly large, passed as string to pass DTO type-check
    };
    
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    await cocktailController.prepareCocktail(invalidRequest, mockResponse);
    
    // Should return 400 Bad Request
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Total volume exceeds maximum allowed'
      })
    );
  });

  it('should log boundary violations for security monitoring', async () => {
    const preparationService = new CocktailPreparationService();
    const loggerSpy = jest.spyOn(preparationService.logger, 'warn');
    
    const attackAttempt = {
      userId: 'attacker-123',
      cocktailId: 'test-cocktail',
      totalVolumeMl: '1000000.00',
      timestamp: new Date().toISOString()
    };
    
    try {
      await preparationService.prepareCocktail(
        attackAttempt.userId,
        attackAttempt.cocktailId,
        1,
         attackAttempt.totalVolumeMl
      );
    } catch (error) {
      // Should log the attempt
      expect(loggerSpy).toHaveBeenCalledWith(
        'Boundary violation attempt detected',
        expect.objectContaining({
          userId: attackAttempt.userId,
          totalVolumeMl: attackAttempt.totalVolumeMl,
          maxAllowed: 10000,
          ipAddress: expect.any(String)
        })
      );
    }
  });
});

**Example TDD for Decimal.js Serialization to JSON:**
```typescript
describe('Decimal.js Serialization', () => {
  it('should serialize decimal.js objects to Strings in JSON responses to prevent IEEE 754 precision loss', () => {
    const inventoryService = new UserInventoryService();
    
    // Mock inventory with decimal.js values
    const decimalInventory = {
      id: 'inv-123',
      ingredientId: 'vodka-456',
      quantity: new Decimal('500.75'), // decimal.js object with string constructor
      unit: 'ml'
    };
    
    // Service method that returns inventory
    jest.spyOn(inventoryService, 'getInventoryItem').mockResolvedValue(decimalInventory);
    
    // Controller that serializes to JSON
    const inventoryController = new InventoryController(inventoryService);
    
    // Get response
    const response = await inventoryController.getInventoryItem('user123', 'inv-123');
    
    // Convert to JSON (simulating HTTP response)
    const jsonResponse = JSON.stringify(response);
    const parsedResponse = JSON.parse(jsonResponse);
    
    // Should be String, not Number, to prevent IEEE 754 precision loss
    expect(typeof parsedResponse.quantity).toBe('string');
    expect(parsedResponse.quantity).toBe('500.75');
    
    // Should NOT contain decimal.js internal structure
    expect(parsedResponse.quantity).not.toHaveProperty('d');
    expect(parsedResponse.quantity).not.toHaveProperty('e');
    expect(parsedResponse.quantity).not.toHaveProperty('s');
  });

  it('should handle decimal.js in nested objects for API responses with String serialization', () => {
    const cocktailService = new CocktailService();
    
    // Mock cocktail with decimal.js in nested ingredients
    const cocktailWithDecimals = {
      id: 'cocktail-123',
      name: 'Test Cocktail',
      ingredients: [
        {
          ingredientId: 'vodka-456',
          amount: new Decimal('2.5'), // decimal.js with string constructor
          unit: 'oz',
          measure: '2.5 oz'
        },
        {
          ingredientId: 'lime-789',
          amount: new Decimal('1'), // decimal.js with string constructor
          unit: 'oz',
          measure: '1 oz'
        }
      ]
    };
    
    jest.spyOn(cocktailService, 'getCocktail').mockResolvedValue(cocktailWithDecimals);
    
    const cocktailController = new CocktailController(cocktailService);
    
    // Simulate API response serialization
    const response = cocktailController.getCocktail('cocktail-123');
    const jsonString = JSON.stringify(response);
    const parsed = JSON.parse(jsonString);
    
    // All decimal.js values should be converted to Strings to prevent IEEE 754 precision loss
    parsed.ingredients.forEach(ingredient => {
      expect(typeof ingredient.amount).toBe('string');
      expect(ingredient.amount).not.toHaveProperty('d');
      expect(ingredient.amount).not.toHaveProperty('e');
      expect(ingredient.amount).not.toHaveProperty('s');
    });
    
    expect(parsed.ingredients[0].amount).toBe('2.5');
    expect(parsed.ingredients[1].amount).toBe('1');
  });

  it('should use class-transformer to automatically convert decimal.js to Strings', () => {
    // DTO with @Transform decorator for String serialization
    class InventoryItemDto {
      @Transform(({ value }) => value instanceof Decimal ? value.toString() : value)
      quantity: string;
      
      ingredientId: string;
      unit: string;
    }
    
    // Entity with decimal.js
    const inventoryEntity = {
      quantity: new Decimal('750.50'), // Use string constructor
      ingredientId: 'gin-123',
      unit: 'ml'
    };
    
    // Transform using class-transformer
    const dto = plainToInstance(InventoryItemDto, inventoryEntity);
    
    // Should be string to prevent IEEE 754 precision loss
    expect(typeof dto.quantity).toBe('string');
    expect(dto.quantity).toBe('750.50');
    
    // Serialize to JSON
    const json = JSON.stringify(dto);
    const parsed = JSON.parse(json);
    
    expect(typeof parsed.quantity).toBe('string');
    expect(parsed.quantity).toBe('750.50');
  });

  it('should handle edge cases: null, undefined, and zero decimal.js values', () => {
    const testCases = [
      { value: new Decimal(0), expected: 0 },
      { value: new Decimal(null), expected: 0 },
      { value: new Decimal(undefined), expected: 0 },
      { value: null, expected: null },
      { value: undefined, expected: undefined },
      { value: new Decimal('NaN'), expected: NaN },
      { value: new Decimal(Infinity), expected: Infinity }
    ];
    
    testCases.forEach(({ value, expected }) => {
      const dto = {
        quantity: value instanceof Decimal ? value.toNumber() : value
      };
      
      const json = JSON.stringify(dto);
      const parsed = JSON.parse(json);
      
      if (expected === undefined) {
        expect(parsed.quantity).toBeUndefined();
      } else if (Number.isNaN(expected)) {
        expect(parsed.quantity).toBeNaN();
      } else {
        expect(parsed.quantity).toBe(expected);
      }
    });
  });
});
```
```
```