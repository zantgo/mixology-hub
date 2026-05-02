# Cocktail Preparation Tests

> **PENDING B2B MIGRATION:** These test specifications reference the old synchronous `UserInventoryService` model. When the codebase is migrated, preparation tests must cover: enqueuing to BullMQ, `202 Accepted` response, Worker-side ACID transaction, `bar_inventory` deduction, and status polling (`queued` → `completed` / `failed_*`).

**Example TDD for Basic Preparation Logic:**
```typescript
describe('Cocktail Preparation - Basic Logic', () => {
  it('should deduct inventory when preparing a cocktail', async () => {
    const inventoryService = new UserInventoryService();
    const Decimal = require('decimal.js');
    
    // Mock user has 100ml of vodka (using decimal.js)
    jest.spyOn(inventoryService, 'getInventoryQuantity')
      .mockResolvedValue(new Decimal('100'));
    
    // Prepare cocktail requiring 30ml (using decimal.js)
    await inventoryService.prepareCocktail('cocktail123', new Decimal('30'));
    
    // Verify inventory was deducted (using decimal.js)
    expect(inventoryService.deductInventory).toHaveBeenCalledWith('vodka', new Decimal('30'));
  });
});
```

**Example TDD for Undo Preparation (UC 4.4):**
```typescript
describe('Cocktail Preparation - Undo Logic', () => {
  it('should accurately restore inventory when a preparation is undone', async () => {
    const inventoryService = new UserInventoryService();
    const Decimal = require('decimal.js');
    
    // User starts with 100ml, prepares drink taking 30ml (using decimal.js)
    await inventoryService.prepareCocktail('cocktail123', new Decimal('30'));
    let current = await inventoryService.getInventoryQuantity('user123', 'vodka');
    expect(current.equals(new Decimal('70'))).toBe(true);
    
    // User hits undo (using decimal.js)
    await inventoryService.undoCocktailPreparation('cocktail123', new Decimal('30'));
    current = await inventoryService.getInventoryQuantity('user123', 'vodka');
    
    // Restored to exactly 100ml
    expect(current.equals(new Decimal('100'))).toBe(true);
  });

  it('should restore deleted row when undoing zero-quantity preparation', async () => {
    const inventoryService = new UserInventoryService();
    const Decimal = require('decimal.js');
    
    // User has exactly 30ml, prepares drink taking all 30ml (using decimal.js)
    await inventoryService.prepareCocktail('cocktail123', new Decimal('30'));
    
    // Row might be deleted (business rule)
    const afterPrepare = await inventoryService.getInventoryQuantity('user123', 'vodka');
    expect(afterPrepare === null || afterPrepare.equals(new Decimal('0'))).toBe(true);
    
    // User hits undo (using decimal.js)
    await inventoryService.undoCocktailPreparation('cocktail123', new Decimal('30'));
    const afterUndo = await inventoryService.getInventoryQuantity('user123', 'vodka');
    
    // Row should be restored with 30ml
    expect(afterUndo.equals(new Decimal('30'))).toBe(true);
  });

  it('should fail-closed (500 error) when undoing preparation with an admin-deleted ingredient', async () => {
    const preparationService = new CocktailPreparationService();
    const logger = { error: jest.fn() };
    preparationService.logger = logger;
    
    // Mock preparation log with an ingredient that no longer exists in global catalog
    const mockLog = {
      id: 'log-123',
      userId: 'user123',
      cocktailId: 'cocktail123',
      ingredients: [
        { ingredientId: 'vodka', amount: new Decimal('60'), unit: 'ml', type: 'regular' },
        { ingredientId: 'deleted-ingredient', amount: new Decimal('30'), unit: 'ml', type: 'regular' }
      ]
    };
    
    jest.spyOn(preparationService.preparationLogRepo, 'findOne').mockResolvedValue(mockLog);
    
    // Mock ingredient service to simulate a deleted ingredient
    const ingredientService = {
      getIngredientById: jest.fn().mockImplementation(async (id) => {
        if (id === 'vodka') return { id: 'vodka', name: 'Vodka', baseUnit: 'ml' };
        if (id === 'deleted-ingredient') return null; // Ingredient was deleted from global catalog
      })
    };
    preparationService.ingredientService = ingredientService;
    
    // Attempting to undo should reject and fail the transaction
    await expect(preparationService.undoPreparation('log-123', 'user123'))
      .rejects
      .toThrow('Internal Server Error: Cannot restore inventory. Ingredient taxonomy has been mutated.');
      
    // Verify the error was logged
    expect(logger.error).toHaveBeenCalledWith(
      'Fail-closed undo triggered: Attempted to restore admin-deleted ingredient',
      { ingredientId: 'deleted-ingredient', preparationLogId: 'log-123' }
    );
  });
});
```

**Example TDD for Time Limit Enforcement (UC 4.19):**
```typescript
describe('Cocktail Preparation - Time Limit Enforcement', () => {
  it('should allow undo within 15-minute window', async () => {
    const inventoryService = new UserInventoryService();
    
    // Mock preparation timestamp 5 minutes ago
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    jest.spyOn(inventoryService, 'getPreparationTimestamp')
      .mockResolvedValue(fiveMinutesAgo);
    
    // Should succeed (within 15 minutes)
    await expect(inventoryService.undoCocktailPreparation('tx-123'))
      .resolves
      .not.toThrow();
  });

  it('should reject undo after 15-minute window', async () => {
    const inventoryService = new UserInventoryService();
    
    // Mock preparation timestamp 20 minutes ago
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    jest.spyOn(inventoryService, 'getPreparationTimestamp')
      .mockResolvedValue(twentyMinutesAgo);
    
    // Should throw TimeLimitExceeded error
    await expect(inventoryService.undoCocktailPreparation('tx-789'))
      .rejects
      .toThrow('TimeLimitExceeded');
  });
});
```

**Example TDD for Unit Conversion (UC 4.21):**
```typescript
describe('Cocktail Preparation - Unit Conversion', () => {
  it('should convert recipe units to match inventory units', async () => {
    const preparationService = new CocktailPreparationService();
    
    // Mock recipe requires 2 oz of vodka
    const mockRecipe = {
      ingredients: [
        { ingredientId: 'vodka', amount: new Decimal('2'), unit: 'oz' }
      ]
    };
    
    // Mock user inventory has vodka in ml (using decimal.js)
    const Decimal = require('decimal.js');
    const mockInventory = {
      ingredientId: 'vodka',
      quantity: new Decimal('500'),
      unit: 'ml'
    };
    
    jest.spyOn(preparationService, 'getRecipe').mockResolvedValue(mockRecipe);
    jest.spyOn(preparationService, 'getInventory').mockResolvedValue([mockInventory]);
    
    // Unit converter should convert 2 oz → 59.147 ml (using decimal.js)
    const Decimal = require('decimal.js');
    const unitConverter = {
      convert: jest.fn().mockReturnValue(new Decimal('59.147'))
    };
    
    preparationService.unitConverter = unitConverter;
    
    await preparationService.prepareCocktail('cocktail123', 1);
    
    // Verify unit conversion was performed
    expect(unitConverter.convert).toHaveBeenCalledWith(2, 'oz', 'ml');
  });

  it('should handle part-based recipes with total volume parameter', async () => {
    const preparationService = new CocktailPreparationService();
    const Decimal = require('decimal.js');
    
    // Mock part-based recipe (2 parts vodka, 1 part lime juice) using decimal.js
    const mockRecipe = {
      ingredients: [
        { ingredientId: 'vodka', amount: new Decimal('2'), unit: 'part' },
        { ingredientId: 'lime-juice', amount: new Decimal('1'), unit: 'part' }
      ]
    };
    
    jest.spyOn(preparationService, 'getRecipe').mockResolvedValue(mockRecipe);
    
    // User specifies total volume of 180ml
    const result = await preparationService.prepareCocktail('cocktail123', 1, '180.00');
    
    // Should calculate: 2 parts vodka = 120ml, 1 part lime = 60ml (using decimal.js)
    expect(result.deductedIngredients).toEqual([
      { ingredientId: 'vodka', amount: new Decimal('120'), unit: 'ml' },
      { ingredientId: 'lime-juice', amount: new Decimal('60'), unit: 'ml' }
    ]);
  });

  it('should use default part size when total volume not specified', async () => {
    const preparationService = new CocktailPreparationService();
    const Decimal = require('decimal.js');
    
    // Mock part-based recipe using decimal.js
    const mockRecipe = {
      ingredients: [
        { ingredientId: 'vodka', amount: new Decimal('2'), unit: 'part' }
      ]
    };
    
    jest.spyOn(preparationService, 'getRecipe').mockResolvedValue(mockRecipe);
    
    // Default part size is 30ml
    preparationService.defaultPartSize = new Decimal('30');
    
    const result = await preparationService.prepareCocktail('cocktail123', 1);
    
    // Should use default: 2 parts × 30ml = 60ml (using decimal.js)
    expect(result.deductedIngredients[0].amount.equals(new Decimal('60'))).toBe(true);
  });
});
```

**Example TDD for Rinse/Garnish Handling (UC 4.21):**
```typescript
describe('Cocktail Preparation - Rinse/Garnish Handling', () => {
  it('should handle rinse ingredients (3ml micro-deduction)', async () => {
    const preparationService = new CocktailPreparationService();
    const Decimal = require('decimal.js');
    
    // Mock recipe with rinse ingredient
    const mockRecipe = {
      ingredients: [
        { ingredientId: 'whiskey', amount: new Decimal('2'), unit: 'oz', type: 'regular' },
        { ingredientId: 'absinthe', amount: null, unit: 'rinse', type: 'rinse' }
      ]
    };
    
    jest.spyOn(preparationService, 'getRecipe').mockResolvedValue(mockRecipe);
    
    const inventoryService = {
      deductInventory: jest.fn().mockResolvedValue(true)
    };
    
    preparationService.inventoryService = inventoryService;
    
    await preparationService.prepareCocktail('cocktail123', 1);
    
    // Should deduct whiskey (2 oz) AND absinthe (3 ml micro-deduction)
    expect(inventoryService.deductInventory).toHaveBeenCalledTimes(2);
    expect(inventoryService.deductInventory).toHaveBeenCalledWith('whiskey', new Decimal('2'), 'oz');
    expect(inventoryService.deductInventory).toHaveBeenCalledWith('absinthe', new Decimal('3'), 'ml');
  });

  it('should restore rinse ingredients during undo (with micro-deduction)', async () => {
    const preparationService = new CocktailPreparationService();
    
    // Mock preparation log with rinse ingredient
    const mockLog = {
      id: 'log-123',
      userId: 'user123',
      cocktailId: 'cocktail123',
      ingredients: [
        { ingredientId: 'whiskey', amount: new Decimal('2'), unit: 'oz', type: 'regular' },
        { ingredientId: 'absinthe', amount: null, unit: 'rinse', type: 'rinse' }
      ]
    };
    
    jest.spyOn(preparationService.preparationLogRepo, 'findOne').mockResolvedValue(mockLog);
    
    const inventoryService = {
      restoreInventory: jest.fn().mockResolvedValue(true)
    };
    
    preparationService.inventoryService = inventoryService;
    
    // Undo the preparation
    await preparationService.undoPreparation('log-123', 'user123');
    
    // Should restore whiskey AND absinthe (3ml micro-deduction was taken)
    expect(inventoryService.restoreInventory).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: [
          { ingredientId: 'whiskey', amount: new Decimal('2'), unit: 'oz' },
          { ingredientId: 'absinthe', amount: new Decimal('3'), unit: 'ml' }
        ]
      })
    );
  });
});
```