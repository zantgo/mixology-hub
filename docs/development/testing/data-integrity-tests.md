# Data Integrity Tests

## Concurrency & Queue Serialization Tests

All inventory mutations flow through a single-threaded BullMQ worker (`concurrency: 1`). Tests must verify that concurrent preparation requests are serialized and double-deductions are mathematically eliminated.

```typescript
describe('BarInventory - Concurrency & Serialization', () => {
  it('should serialize concurrent prepare requests to prevent double-deductions', async () => {
    const job1 = queue.add('prepare-cocktail', { cocktailId, bartenderId: '1' });
    const job2 = queue.add('prepare-cocktail', { cocktailId, bartenderId: '2' });

    await Promise.all([job1, job2]);

    const logs = await preparationLogRepository.find({ order: { createdAt: 'ASC' } });
    expect(logs[0].status).toBe('completed');
    expect(logs[1].status).toBe('failed_insufficient_stock');
  });

  it('should prevent negative inventory balances under concurrent load', async () => {
    await setupInventory({ ingredient: 'Vodka', quantity: 50 });
    const requests = Array.from({ length: 5 }, (_, i) =>
      queue.add('prepare-cocktail', { cocktailId, bartenderId: String(i) })
    );
    await Promise.all(requests);

    const inventory = await barInventoryRepository.findOne({ where: { ingredient: 'Vodka' } });
    expect(inventory.quantity.greaterThanOrEqualTo(0)).toBe(true);
  });
});
```

## Additional Test Specifications
- **Decimal precision**: See `inventory-management-tests.md` (MeasureParserService tests)
- **Unit conversion edge cases**: See `makeable-intelligence-tests.md` (UnitConverterService tests)
- **Ingredient synonym resolution**: Implementation-specific tests would be added here

**Example structure for ingredient synonym tests:**
```typescript
describe('IngredientService - Synonym Resolution', () => {
  it('should recognize Cointreau and Triple Sec as equivalent', async () => {
    const ingredientService = new IngredientService();
    
    // Mock synonym mapping
    jest.spyOn(ingredientService, 'getSynonyms')
      .mockResolvedValue([
        { baseIngredient: 'triple sec', synonym: 'cointreau' },
        { baseIngredient: 'triple sec', synonym: 'orange liqueur' }
      ]);
    
    const result = await ingredientService.resolveIngredient('Cointreau');
    expect(result.baseIngredient).toBe('triple sec');
   });
 });
```

**Example TDD for Database Integrity - UUID Handling:**
```typescript
describe('Database Integrity - UUID Handling', () => {
  it('should handle UUID collisions gracefully', async () => {
    const cocktailService = new CocktailService();
    const mockRepo = { save: jest.fn() };
    cocktailService.cocktailRepo = mockRepo;
    
    // Simulate UUID collision (PostgreSQL unique constraint violation)
    mockRepo.save.mockRejectedValueOnce({
      code: '23505',
      constraint: 'cocktails_pkey'
    }).mockResolvedValueOnce({
      id: 'new-uuid-456',
      name: 'Test Cocktail'
    });
    
    // Should retry with new UUID on collision
    const result = await cocktailService.createCocktail({
      name: 'Test Cocktail',
      ingredients: []
    }, 'user123');
    
    expect(result.id).toBe('new-uuid-456');
    expect(mockRepo.save).toHaveBeenCalledTimes(2);
  });
});
```

**Example TDD for Database Constraints (UC 10.5):**
```typescript
describe('Database Integrity - Constraint Validation', () => {
  it('should validate ingredient names before creation', async () => {
    const ingredientService = new IngredientService();
    
    // Attempt to create ingredient with invalid name
    await expect(
      ingredientService.createIngredient({
        name: '', // Empty name
        category: 'spirit'
      })
    ).rejects.toThrow('Ingredient name is required');
  });

  it('should prevent duplicate ingredient names', async () => {
    const ingredientService = new IngredientService();
    const mockRepo = { findOne: jest.fn() };
    ingredientService.ingredientRepo = mockRepo;
    
    // Mock existing ingredient with same name
    mockRepo.findOne.mockResolvedValue({
      id: 'existing-uuid',
      name: 'Vodka',
      category: 'spirit'
    });
    
    // Attempt to create duplicate
    await expect(
      ingredientService.createIngredient({
        name: 'Vodka',
        category: 'spirit'
      })
    ).rejects.toThrow('Ingredient "Vodka" already exists');
  });

  it('should handle case-insensitive duplicate detection', async () => {
    const ingredientService = new IngredientService();
    const mockRepo = { findOne: jest.fn() };
    ingredientService.ingredientRepo = mockRepo;
    
    // Mock existing ingredient with different casing
    mockRepo.findOne.mockResolvedValue({
      id: 'existing-uuid',
      name: 'vodka', // Lowercase
      category: 'spirit'
    });
    
    // Attempt to create with uppercase
    await expect(
      ingredientService.createIngredient({
        name: 'Vodka', // Uppercase
        category: 'spirit'
      })
    ).rejects.toThrow('Ingredient "Vodka" already exists');
  });
});
```

**Example TDD for Foreign Key Constraints (UC 10.9):**
```typescript
describe('Database Integrity - Foreign Key Constraints', () => {
  it('should validate ingredient exists before adding to inventory', async () => {
    const inventoryService = new UserInventoryService();
    const mockIngredientService = {
      getIngredientById: jest.fn().mockResolvedValue(null) // Ingredient doesn't exist
    };
    
    inventoryService.ingredientService = mockIngredientService;
    
    // Attempt to add non-existent ingredient to inventory
    await expect(
      inventoryService.addToInventory({
        ingredientId: 'non-existent-uuid',
        quantity: new Decimal('100'),
        unit: 'ml'
      }, 'user123')
    ).rejects.toThrow('Ingredient not found');
  });

  it('should validate cocktail exists before preparation', async () => {
    const preparationService = new CocktailPreparationService();
    const mockCocktailService = {
      getCocktailById: jest.fn().mockResolvedValue(null) // Cocktail doesn't exist
    };
    
    preparationService.cocktailService = mockCocktailService;
    
    // Attempt to prepare non-existent cocktail
    await expect(
      preparationService.prepareCocktail('non-existent-uuid', 1, 'user123')
    ).rejects.toThrow('Cocktail not found');
  });

  it('should handle cascade deletion of user data', async () => {
    const userService = new UserService();
    const mockInventoryRepo = { delete: jest.fn() };
    const mockFavoriteRepo = { delete: jest.fn() };
    const mockCocktailRepo = { update: jest.fn() };
    
    userService.inventoryRepo = mockInventoryRepo;
    userService.favoriteRepo = mockFavoriteRepo;
    userService.cocktailRepo = mockCocktailRepo;
    
    // Delete user account
    await userService.deleteUser('user123');
    
    // Should delete inventory and favorites
    expect(mockInventoryRepo.delete).toHaveBeenCalledWith({ userId: 'user123' });
    expect(mockFavoriteRepo.delete).toHaveBeenCalledWith({ userId: 'user123' });
    
    // Should anonymize cocktails (not delete)
    expect(mockCocktailRepo.update).toHaveBeenCalledWith(
      { createdBy: 'user123' },
      { createdBy: null, isPublic: false }
    );
  });
});
```

**Example TDD for Data Validation (UC 10.9):**
```typescript
describe('Database Integrity - Data Validation', () => {
  it('should validate quantity is positive', async () => {
    const inventoryService = new UserInventoryService();
    
    // Attempt to add negative quantity (using decimal.js)
    const Decimal = require('decimal.js');
    await expect(
      inventoryService.addToInventory({
        ingredientId: 'vodka-uuid',
        quantity: new Decimal('-10'), // Negative
        unit: 'ml'
      }, 'user123')
    ).rejects.toThrow('Quantity must be positive');
  });

  it('should validate unit is supported', async () => {
    const inventoryService = new UserInventoryService();
    const mockUnitConverter = {
      isUnitSupported: jest.fn().mockReturnValue(false)
    };
    
    inventoryService.unitConverter = mockUnitConverter;
    
    // Attempt to use unsupported unit
    await expect(
      inventoryService.addToInventory({
        ingredientId: 'vodka-uuid',
        quantity: new Decimal('100'),
        unit: 'invalid-unit'
      }, 'user123')
    ).rejects.toThrow('Unit "invalid-unit" is not supported');
  });

  it('should validate servings is positive integer', async () => {
    const preparationService = new CocktailPreparationService();
    
    // Attempt to prepare with zero servings
    await expect(
      preparationService.prepareCocktail('cocktail-uuid', 0, 'user123')
    ).rejects.toThrow('Servings must be at least 1');
    
    // Attempt to prepare with negative servings
    await expect(
      preparationService.prepareCocktail('cocktail-uuid', -1, 'user123')
    ).rejects.toThrow('Servings must be at least 1');
    
    // Attempt to prepare with fractional servings
    await expect(
      preparationService.prepareCocktail('cocktail-uuid', 1.5, 'user123')
    ).rejects.toThrow('Servings must be an integer');
  });
});
```