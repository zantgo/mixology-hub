# Inventory Management Tests

**Example TDD for `MeasureParserService` (Recurring Decimal Edge Case):**
```typescript
// Test recurring decimals and database precision
describe('MeasureParserService - recurring decimals', () => {
  it('should parse "1/3 oz" and round to 2 decimal places', () => {
    const parser = new MeasureParserService();
    const result = parser.parseMeasure('1/3 oz');
    // 1/3 = 0.333333... → rounded to 0.33 for decimal(10,2)
    expect(result.amount).toBeCloseTo(0.33, 2);
    expect(result.unit).toBe('oz');
  });

  it('should parse "2/3 oz" and round to 2 decimal places', () => {
    const parser = new MeasureParserService();
    const result = parser.parseMeasure('2/3 oz');
    // 2/3 = 0.666666... → rounded to 0.67 for decimal(10,2)
    expect(result.amount).toBeCloseTo(0.67, 2);
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
    
    // Mock starting with 50ml
    jest.spyOn(inventoryService, 'getInventoryQuantity')
      .mockResolvedValue(50);
    
    // Prepare drink requiring 50ml (exact amount)
    await inventoryService.prepareCocktail('cocktail123', 50);
    
    // Verify inventory is now 0 or row is deleted
    const remaining = await inventoryService.getInventoryQuantity('user123', 'vodka');
    
    // Business rule: either 0 or null/undefined (row deleted)
    expect(remaining === 0 || remaining === null || remaining === undefined).toBe(true);
  });

  it('should not show cocktails requiring depleted ingredients', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Mock user has 0ml of vodka
    jest.spyOn(makeableService, 'getUserInventory')
      .mockResolvedValue([{ ingredientId: 'vodka', quantity: 0 }]);
    
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
            quantity: 500,
            ingredient: {
              id: 'vodka',
              name: 'Vodka',
              category: 'spirit',
              imageUrl: '/images/vodka.jpg'
            }
          }
        ])
      })
    };
    
    inventoryService.inventoryRepo = mockRepo;
    
    const result = await inventoryService.getUserInventoryWithDetails('user123');
    
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('quantity', 500);
    expect(result[0]).toHaveProperty('ingredient');
    expect(result[0].ingredient).toHaveProperty('name', 'Vodka');
    expect(result[0].ingredient).toHaveProperty('category', 'spirit');
  });
});

**Example TDD for Inventory Pagination & Sorting (UC 1.12):**
```typescript
describe('UserInventoryService - Pagination & Sorting', () => {
  it('should apply cursor-based pagination to inventory results', async () => {
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
            quantity: 100,
            ingredient: { name: `Ingredient ${i}` }
          })),
          50 // total count
        ])
      })
    };
    inventoryService.inventoryRepo = mockRepo;

    const result = await inventoryService.getPaginatedInventory('user123', {
      limit: 10,
      cursor: 'item-9',
      sortBy: 'name',
      sortOrder: 'ASC'
    });

    expect(result.data).toHaveLength(10);
    expect(result.total).toBe(50);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('item-19');
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
    
    const payload = { ingredientId: 'vodka-123', quantity: 999999999, unit: 'ml' };
    
    await expect(inventoryService.addToInventory('user123', payload))
      .rejects
      .toThrow('Quantity must not exceed 100000');
  });

  it('should accept quantities at the maximum boundary', async () => {
    const inventoryService = new UserInventoryService();
    const mockRepo = { save: jest.fn().mockResolvedValue(true) };
    inventoryService.inventoryRepo = mockRepo;
    
    const payload = { ingredientId: 'vodka-123', quantity: 100000, unit: 'ml' };
    
    await expect(inventoryService.addToInventory('user123', payload)).resolves.not.toThrow();
  });

  it('should prevent decimal overflow in database operations', async () => {
    const inventoryService = new UserInventoryService();
    
    // Test with value that would overflow decimal(10,2)
    const overflowPayload = { ingredientId: 'vodka-123', quantity: 999999999.99, unit: 'ml' };
    
    await expect(inventoryService.addToInventory('user123', overflowPayload))
      .rejects
      .toThrow('Quantity exceeds database precision limits');
  });
});
```

**Example TDD for Makeability with Un-tracked Garnishes (UC 3.10):**
```typescript
describe('MakeableCocktailsService - Garnish Handling', () => {
  it('should treat garnish ingredients as optional by default', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail requires Vodka, Lime Juice, and Mint Sprig (garnish)
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'vodka', amount: 50, unit: 'ml', is_optional: false },
      { ingredientId: 'lime_juice', amount: 25, unit: 'ml', is_optional: false },
      { ingredientId: 'mint_sprig', amount: 1, unit: 'piece', is_optional: true, type: 'garnish' }
    ]);
    
    // User has vodka and lime juice, no mint
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'vodka', quantity: 100 },
      { ingredientId: 'lime_juice', quantity: 50 }
    ]);
    
    const result = await makeableService.checkMakeable('mojito_id', 1);
    
    // Should be makeable despite missing garnish
    expect(result.isMakeable).toBe(true);
    expect(result.missingGarnishes).toEqual(['mint_sprig']);
  });

  it('should flag cocktails as "Makeable (Missing Garnish)"', async () => {
    const makeableService = new MakeableCocktailsService();
    
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'vodka', amount: 50, unit: 'ml' },
      { ingredientId: 'olive', amount: 1, unit: 'piece', type: 'garnish' }
    ]);
    
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'vodka', quantity: 100 }
    ]);
    
    const result = await makeableService.getMakeableCocktails('user123');
    const vodkaMartini = result.find(c => c.name === 'Vodka Martini');
    
    expect(vodkaMartini).toBeDefined();
    expect(vodkaMartini.missingGarnishes).toContain('olive');
    expect(vodkaMartini.status).toBe('makeable_missing_garnish');
  });

  it('should exclude garnish-only cocktails from makeable list', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail that's ONLY garnish (e.g., "Mint Sprig on Ice")
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'mint_sprig', amount: 1, unit: 'piece', type: 'garnish' }
    ]);
    
    const result = await makeableService.getMakeableCocktails('user123');
    
    // Garnish-only cocktails shouldn't appear in makeable list
    expect(result).toHaveLength(0);
  });
});

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
      quantity: 3,
      unit: 'piece'
    };
    
    jest.spyOn(inventoryService, 'validateInventoryPayload').mockReturnValue(true);
    const mockSave = jest.spyOn(inventoryService.inventoryRepo, 'save');
    
    await inventoryService.addToInventory('user123', payload);
    
    // Should save with count unit, not attempt to convert to ml
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 3,
      unit: 'piece',
      baseUnit: 'count'
    }));
  });

  it('should deduct count-based items linearly during preparation', async () => {
    const inventoryService = new UserInventoryService();
    
    // User has 5 lemons
    jest.spyOn(inventoryService, 'getInventoryQuantity')
      .mockResolvedValue(5);
    
    // Cocktail requires 0.5 lemons (half a lemon)
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    
    await inventoryService.prepareCocktail('lemon_drop_id', 0.5, 'piece');
    
    expect(mockDeduct).toHaveBeenCalledWith('user123', 'lemon-123', 0.5);
  });

  it('should handle count-based ingredients in makeability calculations', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail requires 2 mint sprigs (count-based)
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'mint_sprig', amount: 2, unit: 'piece', baseUnit: 'count' }
    ]);
    
    // User has 3 mint sprigs
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'mint_sprig', quantity: 3, unit: 'piece' }
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
      { ingredientId: 'lemon', amount: 1, unit: 'piece', baseUnit: 'count' },
      { ingredientId: 'lime_juice', amount: 50, unit: 'ml', baseUnit: 'volume' }
    ]);
    
    // User has both
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'lemon', quantity: 2, unit: 'piece' },
      { ingredientId: 'lime_juice', quantity: 100, unit: 'ml' }
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
      quantity: 100,
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
      quantity: 100,
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
      quantity: 500
    });
    
    const payload = {
      ingredientId: 'vodka-123', // Already exists
      quantity: 600,
      unit: 'ml'
    };
    
    // Should allow update even at limit
    await expect(inventoryService.addToInventory('user123', payload)).resolves.not.toThrow();
  });

  it('should return 422 Unprocessable Entity for limit violations', async () => {
    const inventoryService = new UserInventoryService();
    
    jest.spyOn(inventoryService.inventoryRepo, 'count').mockResolvedValue(10001);
    
    const payload = { ingredientId: 'test', quantity: 1, unit: 'ml' };
    
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
    
    const payload = { ingredientId: 'new-ingredient', quantity: 1, unit: 'ml' };
    
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
    
    const payload = { ingredientId: 'test', quantity: 1, unit: 'ml' };
    
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
```
```
```