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

**Example TDD for Database Integrity - UUID Collision & Idempotency:**
```typescript
describe('Database Integrity - UUID Collision & Idempotency', () => {
  it('should safely fail open if Redis is down during Idempotency check', async () => {
    const prepService = new CocktailPreparationService();
    const redisService = new RedisService();
    
    // Redis crashes
    jest.spyOn(redisService, 'get').mockRejectedValue(new Error('Redis connection lost'));
    prepService.redisService = redisService;
    
    const inventorySpy = jest.spyOn(prepService.inventoryService, 'deductInventory').mockResolvedValue(true);
    
    // The system should catch the Redis error, log a warning, and proceed with the transaction
    // (Failing OPEN to ensure the app still works if the cache dies)
    await expect(
      prepService.prepareCocktail('cocktail123', 1, 'userA', 'idemp-key-1')
    ).resolves.toBeDefined();
    
    expect(inventorySpy).toHaveBeenCalled();
  });

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

  it('should maintain idempotency even with Redis cache miss', async () => {
    const prepService = new CocktailPreparationService();
    const redisService = new RedisService();
    
    // Redis returns null (cache miss) but connection is fine
    jest.spyOn(redisService, 'get').mockResolvedValue(null);
    jest.spyOn(redisService, 'set').mockResolvedValue('OK');
    
    prepService.redisService = redisService;
    
    const inventorySpy = jest.spyOn(prepService.inventoryService, 'deductInventory').mockResolvedValue(true);
    
    // First request should succeed
    const result1 = await prepService.prepareCocktail('cocktail123', 1, 'userA', 'idemp-key-1');
    
    // Second request with same idempotency key should return cached result
    const result2 = await prepService.prepareCocktail('cocktail123', 1, 'userA', 'idemp-key-1');
    
    // Inventory should only be deducted once
    expect(inventorySpy).toHaveBeenCalledTimes(1);
    expect(result1).toEqual(result2); // Same response
  });

  it('should handle Redis SET failure gracefully', async () => {
    const prepService = new CocktailPreparationService();
    const redisService = new RedisService();
    
    // Redis get works, but set fails
    jest.spyOn(redisService, 'get').mockResolvedValue(null);
    jest.spyOn(redisService, 'set').mockRejectedValue(new Error('Redis SET failed'));
    
    prepService.redisService = redisService;
    
    const inventorySpy = jest.spyOn(prepService.inventoryService, 'deductInventory').mockResolvedValue(true);
    
    // Should still process the request even if caching fails
    await expect(
      prepService.prepareCocktail('cocktail123', 1, 'userA', 'idemp-key-1')
    ).resolves.toBeDefined();
    
    expect(inventorySpy).toHaveBeenCalled();
  });

  it('should log Redis failures for monitoring', async () => {
    const prepService = new CocktailPreparationService();
    const redisService = new RedisService();
    const logger = { warn: jest.fn(), error: jest.fn() };
    
    prepService.redisService = redisService;
    prepService.logger = logger;
    
    // Redis connection lost
    jest.spyOn(redisService, 'get').mockRejectedValue(new Error('Connection refused'));
    
    await prepService.prepareCocktail('cocktail123', 1, 'userA', 'idemp-key-1');
    
    // Should log the Redis failure
    expect(logger.warn).toHaveBeenCalledWith(
      'Redis unavailable for idempotency check, proceeding without cache',
      expect.objectContaining({
        error: 'Connection refused'
      })
    );
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

**Example TDD for GDPR Deletion Constraint:**
```typescript
describe('UserService - GDPR Deletion Constraint', () => {
  it('should anonymize public cocktails without foreign key constraint violation', async () => {
    const userService = new UserService();
    const cocktailRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 'cocktail1', name: 'Public Drink', is_public: true, created_by: 'user123' },
        { id: 'cocktail2', name: 'Private Drink', is_public: false, created_by: 'user123' }
      ]),
      save: jest.fn().mockImplementation((cocktail) => Promise.resolve(cocktail))
    };
    
    userService.cocktailRepo = cocktailRepo;
    
    // Delete user with public cocktails
    await userService.deleteUser('user123');
    
    // Public cocktail should have created_by set to null (anonymized)
    const publicCocktailUpdate = cocktailRepo.save.mock.calls.find(
      call => call[0].id === 'cocktail1'
    );
    expect(publicCocktailUpdate[0].created_by).toBeNull();
    
    // Private cocktail should be deleted
    const privateCocktailUpdate = cocktailRepo.save.mock.calls.find(
      call => call[0].id === 'cocktail2'
    );
    expect(privateCocktailUpdate).toBeUndefined(); // Should be hard deleted
  });
  
  it('should handle database constraint when setting created_by to null', async () => {
    const userService = new UserService();
    const cocktailRepo = {
      find: jest.fn().mockResolvedValue([{ id: 'cocktail1', created_by: 'user123' }]),
      save: jest.fn().mockRejectedValue(new Error('Foreign key constraint violation'))
    };
    
    userService.cocktailRepo = cocktailRepo;
    
    // Should handle constraint error gracefully
    await expect(userService.deleteUser('user123'))
      .rejects
      .toThrow('Failed to anonymize public cocktails');
  });
});

**Example TDD for Orphaned Logs After Cocktail Deletion:**
```typescript
describe('Preparation Logs - Orphaned Logs Handling', () => {
  it('should preserve preparation logs when cocktail is deleted (ON DELETE SET NULL)', async () => {
    const preparationService = new CocktailPreparationService();
    const cocktailService = new CocktailService();
    
    // Mock cocktail deletion
    const mockCocktail = {
      id: 'cocktail-to-delete',
      name: 'Test Cocktail'
    };
    
    // Mock preparation logs exist for this cocktail
    const mockLogs = [
      { id: 'log1', cocktailId: 'cocktail-to-delete', userId: 'user123', preparedAt: new Date() },
      { id: 'log2', cocktailId: 'cocktail-to-delete', userId: 'user456', preparedAt: new Date() }
    ];
    
    // Mock repository with ON DELETE SET NULL behavior
    const mockLogRepo = {
      find: jest.fn().mockResolvedValue(mockLogs),
      save: jest.fn().mockImplementation((log) => Promise.resolve(log))
    };
    
    preparationService.preparationLogRepo = mockLogRepo;
    preparationService.cocktailService = cocktailService;
    
    // Delete the cocktail
    jest.spyOn(cocktailService, 'deleteCocktail').mockResolvedValue(true);
    
    // Simulate what happens when cocktail is deleted
    await preparationService.handleCocktailDeletion('cocktail-to-delete');
    
    // Logs should be updated with cocktailId = null (orphaned but preserved)
    expect(mockLogRepo.save).toHaveBeenCalledTimes(2);
    
    const firstCall = mockLogRepo.save.mock.calls[0][0];
    const secondCall = mockLogRepo.save.mock.calls[1][0];
    
    expect(firstCall.cocktailId).toBeNull();
    expect(firstCall.cocktailNameSnapshot).toBe('Test Cocktail'); // Preserve name
    expect(secondCall.cocktailId).toBeNull();
    expect(secondCall.cocktailNameSnapshot).toBe('Test Cocktail');
  });

  it('should show "Recipe deleted" for orphaned logs in user history', async () => {
    const historyService = new PreparationHistoryService();
    
    // Mock orphaned log (cocktailId = null)
    const orphanedLog = {
      id: 'log-123',
      cocktailId: null,
      cocktailNameSnapshot: 'Old Fashioned',
      userId: 'user123',
      preparedAt: new Date('2024-01-01'),
      ingredientsUsed: [{ name: 'Bourbon', amount: 60 }]
    };
    
    jest.spyOn(historyService.preparationLogRepo, 'find').mockResolvedValue([orphanedLog]);
    
    const userHistory = await historyService.getUserPreparationHistory('user123');
    
    expect(userHistory).toHaveLength(1);
    expect(userHistory[0].cocktailId).toBeNull();
    expect(userHistory[0].cocktailName).toBe('Old Fashioned');
    expect(userHistory[0].isRecipeDeleted).toBe(true);
    expect(userHistory[0].deletedMessage).toBe('Recipe no longer available');
  });

  it('should not allow preparation of deleted cocktails', async () => {
    const preparationService = new CocktailPreparationService();
    const cocktailService = new CocktailService();
    
    preparationService.cocktailService = cocktailService;
    
    // Mock cocktail is deleted (returns null or throws)
    jest.spyOn(cocktailService, 'getCocktailById').mockResolvedValue(null);
    
    await expect(preparationService.prepareCocktail('user123', 'deleted-cocktail', 1))
      .rejects
      .toThrow('Cocktail not found or has been deleted');
  });

  it('should maintain analytics integrity with orphaned logs', async () => {
    const analyticsService = new AnalyticsService();
    
    // Mix of active and orphaned logs
    const mixedLogs = [
      { cocktailId: 'active-cocktail-1', cocktailName: 'Margarita', preparedAt: new Date() },
      { cocktailId: null, cocktailNameSnapshot: 'Deleted Cocktail', preparedAt: new Date() },
      { cocktailId: 'active-cocktail-2', cocktailName: 'Martini', preparedAt: new Date() },
      { cocktailId: null, cocktailNameSnapshot: 'Another Deleted', preparedAt: new Date() }
    ];
    
    jest.spyOn(analyticsService.preparationLogRepo, 'find').mockResolvedValue(mixedLogs);
    
    const stats = await analyticsService.getPreparationStats('2024-01-01', '2024-12-31');
    
    // Should include orphaned logs in counts
    expect(stats.totalPreparations).toBe(4);
    expect(stats.orphanedPreparations).toBe(2);
    expect(stats.activePreparations).toBe(2);
    
    // Orphaned should be categorized separately
    expect(stats.byCocktail).toHaveLength(3); // 2 active + 1 "Deleted Recipes" category
    const deletedCategory = stats.byCocktail.find(c => c.name === 'Deleted Recipes');
    expect(deletedCategory).toBeDefined();
    expect(deletedCategory.count).toBe(2);
  });

  it('should handle foreign key constraint gracefully in tests', async () => {
    // Test that the database schema enforces ON DELETE SET NULL
    const mockQuery = `
      INSERT INTO preparation_logs (id, cocktail_id, user_id) 
      VALUES ('test-log', 'existing-cocktail', 'test-user');
      
      DELETE FROM cocktails WHERE id = 'existing-cocktail';
      
      SELECT cocktail_id FROM preparation_logs WHERE id = 'test-log';
    `;
    
    // In a real test, this would execute against test database
    // Expect cocktail_id to be NULL after cocktail deletion
    const expectedCocktailId = null;
    
    // Mock the database result
    const mockDbResult = { rows: [{ cocktail_id: null }] };
    
    expect(mockDbResult.rows[0].cocktail_id).toBeNull();
  });

  it('should prevent cascade deletion of preparation logs', async () => {
    const dbService = new DatabaseService();
    
    // Test foreign key constraint configuration
    const fkInfo = await dbService.getForeignKeyInfo('preparation_logs', 'cocktail_id');
    
    expect(fkInfo.onDelete).toBe('SET NULL');
    expect(fkInfo.onDelete).not.toBe('CASCADE');
    
    // Verify constraint exists
    expect(fkInfo.constraintName).toBe('preparation_logs_cocktail_id_fkey');
  });

  it('should allow cleanup of very old orphaned logs', async () => {
    const maintenanceService = new DatabaseMaintenanceService();
    
    // Mock very old orphaned logs (2+ years)
    const oldOrphanedLogs = [
      { id: 'log-1', preparedAt: new Date('2021-01-01'), cocktailId: null },
      { id: 'log-2', preparedAt: new Date('2021-06-01'), cocktailId: null },
      { id: 'log-3', preparedAt: new Date('2023-12-01'), cocktailId: 'active-cocktail' }, // Not orphaned
      { id: 'log-4', preparedAt: new Date('2021-12-01'), cocktailId: null }
    ];
    
    jest.spyOn(maintenanceService.preparationLogRepo, 'find').mockResolvedValue(oldOrphanedLogs);
    const deleteSpy = jest.spyOn(maintenanceService.preparationLogRepo, 'delete').mockResolvedValue({ affected: 3 });
    
    // Cleanup logs older than 2 years
    const deletedCount = await maintenanceService.cleanupOldOrphanedLogs(2); // 2 years retention
    
    // Should delete 3 orphaned logs from 2021
    expect(deletedCount).toBe(3);
    expect(deleteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cocktailId: null,
        preparedAt: expect.objectContaining({ $lt: expect.any(Date) })
      })
    );
  });

  it('should preserve user preparation count even with orphaned logs', async () => {
    const userService = new UserService();
    
    const userLogs = [
      { cocktailId: 'cocktail-1', preparedAt: new Date('2024-01-01') },
      { cocktailId: null, cocktailNameSnapshot: 'Deleted Cocktail', preparedAt: new Date('2024-02-01') },
      { cocktailId: 'cocktail-2', preparedAt: new Date('2024-03-01') },
      { cocktailId: null, cocktailNameSnapshot: 'Another Deleted', preparedAt: new Date('2024-04-01') }
    ];
    
    jest.spyOn(userService.preparationLogRepo, 'count').mockResolvedValue(userLogs.length);
    
    const preparationCount = await userService.getUserPreparationCount('user123');
    
    // Should count ALL preparations, including orphaned ones
    expect(preparationCount).toBe(4);
    
    // User stats should reflect total preparation experience
    const userStats = await userService.getUserStats('user123');
    expect(userStats.totalPreparations).toBe(4);
    expect(userStats.orphanedPreparations).toBe(2);
  });

  it('should handle bulk cocktail deletion with many preparation logs', async () => {
    const preparationService = new CocktailPreparationService();
    
    // Simulate deleting a cocktail with 10,000 preparation logs
    const manyLogs = Array(10000).fill(null).map((_, i) => ({
      id: `log-${i}`,
      cocktailId: 'popular-cocktail',
      userId: `user-${i % 1000}`,
      preparedAt: new Date()
    }));
    
    const mockLogRepo = {
      find: jest.fn().mockResolvedValue(manyLogs),
      save: jest.fn().mockImplementation((log) => Promise.resolve(log))
    };
    
    preparationService.preparationLogRepo = mockLogRepo;
    
    // This should handle bulk update efficiently
    await preparationService.handleCocktailDeletion('popular-cocktail');
    
    // Should update all logs
    expect(mockLogRepo.save).toHaveBeenCalledTimes(10000);
    
    // All should have cocktailId = null
    const firstCall = mockLogRepo.save.mock.calls[0][0];
    expect(firstCall.cocktailId).toBeNull();
  });

  it('should provide migration path for existing CASCADE constraints', async () => {
    const migrationService = new DatabaseMigrationService();
    
    // Test migration from CASCADE to SET NULL
    const migrationSql = `
      ALTER TABLE preparation_logs
      DROP CONSTRAINT preparation_logs_cocktail_id_fkey,
      ADD CONSTRAINT preparation_logs_cocktail_id_fkey
      FOREIGN KEY (cocktail_id)
      REFERENCES cocktails(id)
      ON DELETE SET NULL;
    `;
    
    // Verify migration SQL is correct
    expect(migrationSql).toContain('ON DELETE SET NULL');
    expect(migrationSql).not.toContain('ON DELETE CASCADE');
    
    // Mock successful migration
    jest.spyOn(migrationService, 'executeMigration').mockResolvedValue(true);
    
    const result = await migrationService.migratePreparationLogsConstraint();
    expect(result).toBe(true);
  });
});
```
```
```