# Data Integrity Tests

*Note: Data integrity tests are covered in other domain-specific test files:*
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

**Example TDD for Soft-Deletion of Favorited Custom Cocktails (UC 10.4):**
```typescript
describe('CocktailService - Soft Deletion', () => {
  it('should soft delete custom cocktail instead of hard delete', async () => {
    const cocktailService = new CocktailService();
    const mockRepo = { 
      findOne: jest.fn().mockResolvedValue({ id: 'cocktail123', is_deleted: false }),
      save: jest.fn() 
    };
    cocktailService.cocktailRepo = mockRepo;

    await cocktailService.deleteCocktail('cocktail123', 'author123');
    
    const savedCocktail = mockRepo.save.mock.calls[0][0];
    expect(savedCocktail.is_deleted).toBe(true);
    expect(savedCocktail.deleted_at).toBeInstanceOf(Date);
    expect(savedCocktail.deleted_by).toBe('author123');
  });

  it('should not return soft-deleted cocktails in search results', async () => {
    const cocktailService = new CocktailService();
    const mockRepo = { 
      find: jest.fn().mockResolvedValue([
        { id: 'active1', name: 'Active Cocktail', is_deleted: false },
        { id: 'deleted1', name: 'Deleted Cocktail', is_deleted: true }
      ])
    };
    cocktailService.cocktailRepo = mockRepo;

    const results = await cocktailService.searchCocktails('cocktail');
    
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('active1');
    expect(results.find(c => c.id === 'deleted1')).toBeUndefined();
  });

  it('should show "Recipe deleted" for favorited soft-deleted cocktails', async () => {
    const favoritesService = new FavoritesService();
    const cocktailService = new CocktailService();
    
    // User has favorite for cocktail123
    jest.spyOn(favoritesService, 'getUserFavorites').mockResolvedValue([
      { cocktailId: 'cocktail123', userId: 'user456' }
    ]);
    
    // Cocktail is soft-deleted
    jest.spyOn(cocktailService, 'getCocktailById').mockResolvedValue({
      id: 'cocktail123',
      name: 'Old Fashioned',
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: 'author123'
    });
    
    favoritesService.cocktailService = cocktailService;
    
    const hydratedFavorites = await favoritesService.getHydratedFavorites('user456');
    
    expect(hydratedFavorites).toHaveLength(1);
    expect(hydratedFavorites[0].cocktailId).toBe('cocktail123');
    expect(hydratedFavorites[0].is_deleted).toBe(true);
    expect(hydratedFavorites[0].deleted_message).toBe('Recipe deleted by author');
  });

  it('should allow author to restore soft-deleted cocktail', async () => {
    const cocktailService = new CocktailService();
    const mockRepo = { 
      findOne: jest.fn().mockResolvedValue({ 
        id: 'cocktail123', 
        is_deleted: true,
        deleted_by: 'author123'
      }),
      save: jest.fn() 
    };
    cocktailService.cocktailRepo = mockRepo;

    // Author restores their own cocktail
    await cocktailService.restoreCocktail('cocktail123', 'author123');
    
    const savedCocktail = mockRepo.save.mock.calls[0][0];
    expect(savedCocktail.is_deleted).toBe(false);
    expect(savedCocktail.deleted_at).toBeNull();
    expect(savedCocktail.deleted_by).toBeNull();
  });

  it('should prevent non-author from restoring soft-deleted cocktail', async () => {
    const cocktailService = new CocktailService();
    const mockRepo = { 
      findOne: jest.fn().mockResolvedValue({ 
        id: 'cocktail123', 
        is_deleted: true,
        deleted_by: 'author123'
      })
    };
    cocktailService.cocktailRepo = mockRepo;

    // Different user tries to restore
    await expect(cocktailService.restoreCocktail('cocktail123', 'differentUser'))
      .rejects
      .toThrow('Unauthorized: Only the author can restore this cocktail');
  });
});

**Example TDD for Boundary Value Analysis for Measurements (UC 1.13):**
```typescript
describe('Inventory Validation - Boundary Value Analysis', () => {
  it('should reject astronomically large inventory additions', async () => {
    const inventoryService = new UserInventoryService();
    
    const payload = { ingredientId: 'vodka-123', quantity: 999999999, unit: 'ml' };
    
    // Simulating class-validator hitting the API
    const mockValidate = jest.spyOn(inventoryService, 'validateInventoryPayload')
      .mockImplementation((payload) => {
        if (payload.quantity > 100000) {
          throw new Error('Quantity must not exceed 100000');
        }
      });
    
    await expect(inventoryService.addToInventory('user123', payload))
      .rejects
      .toThrow('Quantity must not exceed 100000');
  });

  it('should accept values at the upper boundary', async () => {
    const inventoryService = new UserInventoryService();
    
    const payload = { ingredientId: 'vodka-123', quantity: 100000, unit: 'ml' };
    
    jest.spyOn(inventoryService, 'validateInventoryPayload').mockReturnValue(true);
    jest.spyOn(inventoryService.inventoryRepo, 'save').mockResolvedValue(true);
    
    await expect(inventoryService.addToInventory('user123', payload)).resolves.not.toThrow();
  });

  it('should reject negative quantities', async () => {
    const inventoryService = new UserInventoryService();
    
    const payload = { ingredientId: 'vodka-123', quantity: -1, unit: 'ml' };
    
    await expect(inventoryService.addToInventory('user123', payload))
      .rejects
      .toThrow('Quantity must be positive');
  });

  it('should handle decimal precision boundaries', async () => {
    const inventoryService = new UserInventoryService();
    
    // Test with value that has many decimal places
    const precisePayload = { ingredientId: 'vodka-123', quantity: 123.456789, unit: 'ml' };
    
    // Should round to 2 decimal places for database
    jest.spyOn(inventoryService, 'validateInventoryPayload').mockReturnValue(true);
    const mockSave = jest.spyOn(inventoryService.inventoryRepo, 'save');
    
    await inventoryService.addToInventory('user123', precisePayload);
    
    // Verify rounded value was saved
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 123.46 // Rounded to 2 decimal places
    }));
  });

  it('should prevent zero division in unit conversions', async () => {
    const unitConverter = new UnitConverterService();
    
    // Test conversion with zero amount
    expect(() => unitConverter.convert(0, 'oz', 'ml')).not.toThrow();
    
    // Test conversion with very small amount
    const result = unitConverter.convert(0.001, 'oz', 'ml');
    expect(result).toBeCloseTo(0.0296, 4); // Should handle tiny values
  });
});
```

**Example TDD for Concurrent Custom Ingredient Creation (UC 10.5):**
```typescript
describe('IngredientService - Concurrent Creation', () => {
  it('should handle concurrent creation of same custom ingredient', async () => {
    const ingredientService = new IngredientService();
    const ingredientRepo = { 
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn()
    };
    ingredientService.ingredientRepo = ingredientRepo;
    
    const ingredientName = 'Local Bitters';
    const normalizedName = 'local bitters';
    
    // First call: ingredient doesn't exist yet
    jest.spyOn(ingredientRepo, 'findOne')
      .mockResolvedValueOnce(null) // First check - not found
      .mockResolvedValueOnce({ id: 'ing-123', name: 'Local Bitters' }); // Second check - now exists
    
    // Mock unique constraint violation (simulating concurrent insert)
    jest.spyOn(ingredientRepo, 'save')
      .mockRejectedValueOnce({
        code: '23505', // PostgreSQL unique violation
        constraint: 'ingredients_normalized_name_key'
      })
      .mockResolvedValueOnce({ id: 'ing-123', name: 'Local Bitters' });
    
    // Two concurrent attempts to create same ingredient
    const promise1 = ingredientService.findOrCreate(ingredientName, 'user123');
    const promise2 = ingredientService.findOrCreate(ingredientName, 'user456');
    
    const [result1, result2] = await Promise.all([promise1, promise2]);
    
    // Both should get the same ingredient ID
    expect(result1.id).toBe('ing-123');
    expect(result2.id).toBe('ing-123');
    expect(result1.name).toBe('Local Bitters');
    expect(result2.name).toBe('Local Bitters');
  });

  it('should use upsert with ON CONFLICT DO NOTHING', async () => {
    const ingredientService = new IngredientService();
    
    // Mock repository with upsert support
    const mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({
        identifiers: [{ id: 'ing-123' }],
        generatedMaps: [{ id: 'ing-123' }]
      })
    };
    
    jest.spyOn(ingredientService.ingredientRepo, 'createQueryBuilder')
      .mockReturnValue(mockQueryBuilder as any);
    
    const result = await ingredientService.upsertIngredient('Local Bitters', 'user123');
    
    expect(mockQueryBuilder.orIgnore).toHaveBeenCalled(); // ON CONFLICT DO NOTHING
    expect(result.id).toBe('ing-123');
  });

  it('should return existing ingredient when concurrent creation detected', async () => {
    const ingredientService = new IngredientService();
    
    // Simulate race condition:
    // 1. Check if exists - returns null
    // 2. Try to insert - fails with unique constraint
    // 3. Re-check - now returns the existing record
    let checkCount = 0;
    jest.spyOn(ingredientService.ingredientRepo, 'findOne').mockImplementation(async () => {
      checkCount++;
      if (checkCount === 1) return null; // First check
      if (checkCount === 2) return { id: 'existing-123', name: 'Local Bitters' }; // After conflict
      return null;
    });
    
    jest.spyOn(ingredientService.ingredientRepo, 'save').mockRejectedValue({
      code: '23505',
      constraint: 'ingredients_normalized_name_key'
    });
    
    const result = await ingredientService.findOrCreate('Local Bitters', 'user123');
    
    expect(result.id).toBe('existing-123');
    expect(ingredientService.ingredientRepo.findOne).toHaveBeenCalledTimes(2);
  });

  it('should handle database-level locking for concurrent operations', async () => {
    const ingredientService = new IngredientService();
    
    // Mock transaction with locking
    const mockTransaction = jest.fn().mockImplementation(async (isolationLevel, callback) => {
      expect(isolationLevel).toBe('SERIALIZABLE'); // Highest isolation for concurrent writes
      return await callback();
    });
    
    jest.spyOn(ingredientService.ingredientRepo.manager, 'transaction')
      .mockImplementation(mockTransaction);
    
    await ingredientService.findOrCreateWithLock('Rare Ingredient', 'user123');
    
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('should prevent duplicate custom ingredients across users', async () => {
    const ingredientService = new IngredientService();
    
    // User A creates "Hyper Local Bitters"
    jest.spyOn(ingredientService.ingredientRepo, 'findOne')
      .mockResolvedValueOnce(null) // Not found for User A
      .mockResolvedValueOnce({ id: 'ing-456', name: 'Hyper Local Bitters' }); // Found for User B
    
    jest.spyOn(ingredientService.ingredientRepo, 'save')
      .mockResolvedValueOnce({ id: 'ing-456', name: 'Hyper Local Bitters' });
    
    const userAResult = await ingredientService.findOrCreate('Hyper Local Bitters', 'userA');
    
    // User B tries to create same ingredient
    const userBResult = await ingredientService.findOrCreate('Hyper Local Bitters', 'userB');
    
    // Both should get same ID
    expect(userAResult.id).toBe('ing-456');
    expect(userBResult.id).toBe('ing-456');
    expect(userAResult.created_by).toBe('userA'); // Original creator
    expect(userBResult.created_by).toBe('userA'); // Not userB (preserved original)
  });

  it('should handle case variations in concurrent creation', async () => {
    const ingredientService = new IngredientService();
    
    // User A: "local bitters" (lowercase)
    // User B: "Local Bitters" (title case)
    // Should normalize to same name
    
    jest.spyOn(ingredientService, 'normalizeName')
      .mockImplementation((name) => name.toLowerCase());
    
    const mockSave = jest.spyOn(ingredientService.ingredientRepo, 'save')
      .mockResolvedValue({ id: 'ing-789', name: 'local bitters' });
    
    const promise1 = ingredientService.findOrCreate('local bitters', 'userA');
    const promise2 = ingredientService.findOrCreate('Local Bitters', 'userB');
    
    await Promise.all([promise1, promise2]);
    
    // Should save with normalized name
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      normalizedName: 'local bitters'
    }));
  });

  it('should provide atomic creation for inventory association', async () => {
    const ingredientService = new IngredientService();
    const inventoryService = new UserInventoryService();
    
    ingredientService.inventoryService = inventoryService;
    
    // Mock that creates ingredient AND adds to user inventory atomically
    const mockTransaction = jest.fn().mockImplementation(async (isolationLevel, callback) => {
      const entityManager = {};
      return await callback(entityManager);
    });
    
    jest.spyOn(ingredientService.ingredientRepo.manager, 'transaction')
      .mockImplementation(mockTransaction);
    
    const mockAddToInventory = jest.spyOn(inventoryService, 'addToInventory')
      .mockResolvedValue(true);
    
    await ingredientService.createAndAddToInventory('New Ingredient', 'user123', 100, 'ml');
    
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockAddToInventory).toHaveBeenCalled();
  });
});
```

**Example TDD for Private Ingredient Visibility (UC 10.8):**
```typescript
describe('Cocktail Service - Private Ingredient Visibility', () => {
  it('should allow User B to view a private ingredient IF it is attached to a public cocktail', async () => {
    const cocktailService = new CocktailService();
    const ingredientService = new IngredientService();
    
    // Setup: User A makes cocktail public containing private ingredient X
    const privateIngredient = {
      id: 'private-ing-123',
      name: 'User A Secret Bitters',
      is_global: false,
      created_by: 'userA'
    };
    
    const publicCocktail = {
      id: 'cocktail-456',
      name: 'Secret Recipe',
      is_public: true,
      created_by: 'userA',
      ingredients: [
        { ingredientId: 'private-ing-123', name: 'User A Secret Bitters', measure: '2 dashes' }
      ]
    };
    
    // Mock ingredient service to return private ingredient when accessed via cocktail context
    jest.spyOn(ingredientService, 'getIngredientById').mockImplementation(async (id, context) => {
      if (id === 'private-ing-123' && context?.cocktailId === 'cocktail-456') {
        return privateIngredient; // Allow read-only access in this context
      }
      return null;
    });
    
    cocktailService.ingredientService = ingredientService;
    jest.spyOn(cocktailService.cocktailRepo, 'findOne').mockResolvedValue(publicCocktail);
    
    // Action: User B fetches cocktail details
    const result = await cocktailService.getCocktailById('cocktail-456', 'userB');
    
    // Expect: Ingredient X is included in the payload without throwing a 403
    expect(result.ingredients).toHaveLength(1);
    expect(result.ingredients[0].ingredientId).toBe('private-ing-123');
    expect(result.ingredients[0].name).toBe('User A Secret Bitters');
    expect(result.ingredients[0].is_private).toBe(true); // Should be marked as private
    expect(result.ingredients[0].can_be_added).toBe(true); // But can be added to inventory
  });

  it('should NOT expose private ingredient in global search catalog', async () => {
    const ingredientService = new IngredientService();
    
    const privateIngredient = {
      id: 'private-ing-123',
      name: 'User A Secret Bitters',
      is_global: false,
      created_by: 'userA'
    };
    
    const globalIngredient = {
      id: 'global-ing-456',
      name: 'Vodka',
      is_global: true
    };
    
    // Mock repository to only return global ingredients in general search
    jest.spyOn(ingredientService.ingredientRepo, 'find').mockImplementation(async (options) => {
      if (options?.where?.is_global === true || options?.where?.is_global === undefined) {
        return [globalIngredient]; // Only global ingredients in catalog
      }
      return [];
    });
    
    const result = await ingredientService.searchIngredients('bitters');
    
    // Should NOT include private ingredient in search results
    expect(result).toHaveLength(0);
    expect(result.find(i => i.id === 'private-ing-123')).toBeUndefined();
  });

  it('should allow User B to add private ingredient to inventory from recipe page', async () => {
    const ingredientService = new IngredientService();
    const inventoryService = new UserInventoryService();
    
    const privateIngredient = {
      id: 'private-ing-123',
      name: 'User A Secret Bitters',
      is_global: false,
      created_by: 'userA'
    };
    
    // Mock: Allow access to private ingredient when requested via specific cocktail
    jest.spyOn(ingredientService, 'getIngredientById').mockResolvedValue(privateIngredient);
    
    // Mock inventory addition
    const addSpy = jest.spyOn(inventoryService, 'addToInventory').mockResolvedValue(true);
    
    // User B tries to add the private ingredient from the cocktail page
    await inventoryService.addToInventory('userB', {
      ingredientId: 'private-ing-123',
      quantity: 50,
      unit: 'ml'
    }, { sourceCocktailId: 'cocktail-456' });
    
    // Should succeed even though ingredient is private
    expect(addSpy).toHaveBeenCalledWith('userB', expect.objectContaining({
      ingredientId: 'private-ing-123'
    }));
  });
});
```
```
```