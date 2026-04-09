# Cocktail Preparation Tests

**Example TDD for Concurrent Requests (UC 4.3):**
```typescript
describe('Cocktail Preparation - Race Condition Prevention', () => {
  it('should prevent negative inventory with concurrent requests', async () => {
    const inventoryService = new UserInventoryService();
    
    // Mock user has exactly 50ml of vodka
    jest.spyOn(inventoryService, 'getInventoryQuantity')
      .mockResolvedValue(50);
    
    // Simulate two concurrent prepare requests
    const request1 = inventoryService.prepareCocktail('cocktail123', 30);
    const request2 = inventoryService.prepareCocktail('cocktail123', 30);
    
    const results = await Promise.allSettled([request1, request2]);
    
    // One should succeed, one should fail
    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');
    
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason.message).toContain('insufficient stock');
  });
});
```

**Example TDD for Undo Preparation (UC 4.4):**
```typescript
describe('Cocktail Preparation - Undo Logic', () => {
  it('should accurately restore inventory when a preparation is undone', async () => {
    const inventoryService = new UserInventoryService();
    
    // User starts with 100ml, prepares drink taking 30ml
    await inventoryService.prepareCocktail('cocktail123', 30);
    let current = await inventoryService.getInventoryQuantity('user123', 'vodka');
    expect(current).toBe(70);
    
    // User hits undo
    await inventoryService.undoCocktailPreparation('cocktail123', 30);
    current = await inventoryService.getInventoryQuantity('user123', 'vodka');
    
    // Restored to exactly 100ml
    expect(current).toBe(100);
  });

  it('should restore deleted row when undoing zero-quantity preparation', async () => {
    const inventoryService = new UserInventoryService();
    
    // User has exactly 30ml, prepares drink taking all 30ml
    await inventoryService.prepareCocktail('cocktail123', 30);
    
    // Row might be deleted (business rule)
    const afterPrepare = await inventoryService.getInventoryQuantity('user123', 'vodka');
    expect(afterPrepare === 0 || afterPrepare === null).toBe(true);
    
    // User hits undo
    await inventoryService.undoCocktailPreparation('cocktail123', 30);
    const afterUndo = await inventoryService.getInventoryQuantity('user123', 'vodka');
    
    // Row should be restored with 30ml
    expect(afterUndo).toBe(30);
  });
});
```

**Example TDD for Batch Preparation (UC 4.5):**
```typescript
describe('Cocktail Preparation - Batch Deduction', () => {
  it('should deduct scaled amounts for batch preparation', async () => {
    const inventoryService = new UserInventoryService();
    
    // User starts with 500ml
    jest.spyOn(inventoryService, 'getInventoryQuantity')
      .mockResolvedValue(500);
    
    // Prepare 4 servings of a drink requiring 30ml each
    await inventoryService.prepareCocktailBatch('cocktail123', 30, 4);
    
    // Should deduct 120ml total (30 * 4)
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    expect(mockDeduct).toHaveBeenCalledWith('user123', 'vodka', 120);
  });

  it('should rollback entire batch if any ingredient insufficient', async () => {
    const inventoryService = new UserInventoryService();
    
    // User has 100ml of vodka but only 50ml of lime juice
    jest.spyOn(inventoryService, 'getInventoryQuantity')
      .mockResolvedValueOnce(100)  // vodka
      .mockResolvedValueOnce(50);  // lime juice
    
    // Cocktail requires 30ml vodka and 20ml lime juice per serving
    // 4 servings requires 120ml vodka (insufficient) and 80ml lime juice
    await expect(
      inventoryService.prepareCocktailBatch('cocktail123', [
        { ingredientId: 'vodka', amount: 30 },
        { ingredientId: 'lime', amount: 20 }
      ], 4)
    ).rejects.toThrow('Insufficient stock for ingredient: vodka');
    
    // Verify no deductions were made (transaction rolled back)
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    expect(mockDeduct).not.toHaveBeenCalled();
  });
});

**Example TDD for Deducting Optional Ingredients conditionally (UC 4.6):**
```typescript
describe('Cocktail Preparation - Optional Ingredients Logic', () => {
  it('should deduct optional ingredient if user has it', async () => {
    const inventoryService = new UserInventoryService();
    
    // User has Gin, Tonic, and Lime
    jest.spyOn(inventoryService, 'getInventoryQuantity')
      .mockImplementation(async (_, ingredient) => ingredient === 'lime' ? 1 : 100);
      
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    
    await inventoryService.prepareCocktail('gin_tonic_id', 1);
    
    // Should deduct the optional lime
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'lime', 1);
  });

  it('should NOT fail transaction if user lacks an optional ingredient', async () => {
    const inventoryService = new UserInventoryService();
    
    // User has Gin and Tonic, but NO Lime (0 qty)
    jest.spyOn(inventoryService, 'getInventoryQuantity')
      .mockImplementation(async (_, ingredient) => ingredient === 'lime' ? 0 : 100);
      
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    
    await expect(inventoryService.prepareCocktail('gin_tonic_id', 1)).resolves.not.toThrow();
    
    // Should deduct base ingredients, but skip lime
    expect(mockDeduct).not.toHaveBeenCalledWith(expect.any(String), 'lime', expect.any(Number));
  });

  it('should handle multiple optional ingredients with mixed availability', async () => {
    const inventoryService = new UserInventoryService();
    
    // User has salt (2), NO sugar (0), has lime (1)
    jest.spyOn(inventoryService, 'getInventoryQuantity')
      .mockImplementation(async (_, ingredient) => {
        if (ingredient === 'salt') return 2;
        if (ingredient === 'sugar') return 0;
        if (ingredient === 'lime') return 1;
        return 100; // base ingredients
      });
      
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    
    await inventoryService.prepareCocktail('margarita_id', 1);
    
    // Should deduct salt and lime, but skip sugar
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'salt', 1);
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'lime', 1);
    expect(mockDeduct).not.toHaveBeenCalledWith(expect.any(String), 'sugar', expect.any(Number));
  });
});

**Example TDD for Time-Bounded "Undo" Functionality (UC 4.8):**
```typescript
describe('Cocktail Preparation - Undo Boundaries', () => {
  it('should reject undo requests older than 15 minutes', async () => {
    const inventoryService = new UserInventoryService();
    const transactionRepo = { findOne: jest.fn() };
    inventoryService.transactionRepo = transactionRepo;
    
    // Mock a preparation transaction from 20 minutes ago
    const oldTransaction = { 
      id: 'tx-123', 
      created_at: new Date(Date.now() - 20 * 60000) // 20 minutes ago
    };
    jest.spyOn(transactionRepo, 'findOne').mockResolvedValue(oldTransaction);
    
    await expect(inventoryService.undoCocktailPreparation('tx-123'))
      .rejects
      .toThrow('TimeLimitExceeded: Preparations can only be undone within 15 minutes');
  });

  it('should allow undo requests within 15-minute window', async () => {
    const inventoryService = new UserInventoryService();
    const transactionRepo = { findOne: jest.fn() };
    inventoryService.transactionRepo = transactionRepo;
    
    // Mock a preparation transaction from 5 minutes ago
    const recentTransaction = { 
      id: 'tx-456', 
      created_at: new Date(Date.now() - 5 * 60000) // 5 minutes ago
    };
    jest.spyOn(transactionRepo, 'findOne').mockResolvedValue(recentTransaction);
    
    // Mock successful undo
    jest.spyOn(inventoryService, 'restoreInventory').mockResolvedValue(true);
    
    await expect(inventoryService.undoCocktailPreparation('tx-456')).resolves.not.toThrow();
  });

  it('should calculate time difference correctly across timezones', async () => {
    const inventoryService = new UserInventoryService();
    const transactionRepo = { findOne: jest.fn() };
    inventoryService.transactionRepo = transactionRepo;
    
    // Mock transaction with UTC timestamp
    const utcTransaction = { 
      id: 'tx-789', 
      created_at: new Date('2024-01-01T10:00:00Z') // Fixed UTC time
    };
    jest.spyOn(transactionRepo, 'findOne').mockResolvedValue(utcTransaction);
    
    // Mock current time as 16 minutes later in UTC
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-01T10:16:00Z').getTime());
    
    await expect(inventoryService.undoCocktailPreparation('tx-789'))
      .rejects
      .toThrow('TimeLimitExceeded');
  });
});

**Example TDD for Database Transaction Isolation Level:**
```typescript
describe('Cocktail Preparation - Transaction Isolation', () => {
  it('should use SERIALIZABLE or REPEATABLE READ to prevent phantom reads during batch prep', async () => {
    const inventoryService = new UserInventoryService();
    
    // Spy on the transaction manager to ensure correct isolation level is passed
    const transactionSpy = jest.spyOn(inventoryService.inventoryRepo.manager, 'transaction');
    
    await inventoryService.prepareCocktail('cocktail123', 1);
    
    // TypeORM should be explicitly instructed to use a strict isolation level
    expect(transactionSpy).toHaveBeenCalledWith(
      'SERIALIZABLE', 
      expect.any(Function)
    );
  });

  it('should prevent dirty reads with READ COMMITTED isolation at minimum', async () => {
    const inventoryService = new UserInventoryService();
    
    // Mock two concurrent transactions
    const mockTransaction = jest.fn().mockImplementation(async (isolationLevel, callback) => {
      expect(['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE']).toContain(isolationLevel);
      return await callback();
    });
    
    jest.spyOn(inventoryService.inventoryRepo.manager, 'transaction').mockImplementation(mockTransaction);
    
    await inventoryService.prepareCocktail('cocktail123', 1);
    
    // Verify isolation level was specified
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('should handle transaction rollback on constraint violations', async () => {
    const inventoryService = new UserInventoryService();
    
    // Mock transaction that will fail
    const mockTransaction = jest.fn().mockImplementation(async (isolationLevel, callback) => {
      try {
        return await callback();
      } catch (error) {
        // Simulate rollback
        throw error;
      }
    });
    
    jest.spyOn(inventoryService.inventoryRepo.manager, 'transaction').mockImplementation(mockTransaction);
    
    // Mock deduction that will fail (e.g., foreign key constraint)
    jest.spyOn(inventoryService, 'deductInventory').mockRejectedValue(
      new Error('Foreign key constraint violation')
    );
    
    await expect(inventoryService.prepareCocktail('cocktail123', 1))
      .rejects
      .toThrow('Foreign key constraint violation');
    
    // Transaction should have been rolled back
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('should maintain isolation across nested service calls', async () => {
    const inventoryService = new UserInventoryService();
    const auditService = new AuditService();
    
    // Both services should use same transaction context
    const mockTransaction = jest.fn().mockImplementation(async (isolationLevel, callback) => {
      const entityManager = {}; // Mock entity manager
      return await callback(entityManager);
    });
    
    jest.spyOn(inventoryService.inventoryRepo.manager, 'transaction').mockImplementation(mockTransaction);
    
    // Mock audit service to be called within transaction
    const auditSpy = jest.spyOn(auditService, 'logPreparation').mockResolvedValue(true);
    inventoryService.auditService = auditService;
    
    await inventoryService.prepareCocktail('cocktail123', 1);
    
    // Audit should be called within same transaction
    expect(auditSpy).toHaveBeenCalled();
  });
});
```

**Example TDD for Preparing Part/Ratio-Based Cocktails (UC 4.7):**
```typescript
describe('Cocktail Preparation - Part-Based Deduction', () => {
  it('should calculate absolute volumes from parts when totalVolume provided', async () => {
    const inventoryService = new UserInventoryService();
    
    // Mock cocktail requirements: 1 part Gin, 1 part Campari, 1 part Vermouth
    jest.spyOn(inventoryService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'gin', amount: 1, unit: 'part' },
      { ingredientId: 'campari', amount: 1, unit: 'part' },
      { ingredientId: 'vermouth', amount: 1, unit: 'part' }
    ]);
    
    // User has 500ml of each ingredient
    jest.spyOn(inventoryService, 'getInventoryQuantity').mockResolvedValue(500);
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    
    // Prepare a 3-part drink aiming for 150ml total
    await inventoryService.prepareCocktail('negroni_id', 1, { totalVolumeMl: 150 });
    
    // Should deduct exactly 50ml per part (150ml total / 3 parts = 50ml per part)
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'gin', 50);
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'campari', 50);
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'vermouth', 50);
  });

  it('should handle unequal part ratios', async () => {
    const inventoryService = new UserInventoryService();
    
    // Cocktail: 2 parts Gin, 1 part Vermouth (3 parts total)
    jest.spyOn(inventoryService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'gin', amount: 2, unit: 'part' },
      { ingredientId: 'vermouth', amount: 1, unit: 'part' }
    ]);
    
    jest.spyOn(inventoryService, 'getInventoryQuantity').mockResolvedValue(500);
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    
    // Prepare 90ml total
    await inventoryService.prepareCocktail('martini_id', 1, { totalVolumeMl: 90 });
    
    // Gin: (2/3) * 90 = 60ml
    // Vermouth: (1/3) * 90 = 30ml
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'gin', 60);
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'vermouth', 30);
  });

  it('should reject part-based preparation if totalVolume is missing', async () => {
    const inventoryService = new UserInventoryService();
    
    jest.spyOn(inventoryService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'gin', amount: 1, unit: 'part' }
    ]);
    
    await expect(inventoryService.prepareCocktail('negroni_id', 1, {}))
      .rejects
      .toThrow('totalVolumeMl is required to prepare a ratio-based cocktail');
  });

  it('should validate total volume is positive', async () => {
    const inventoryService = new UserInventoryService();
    
    jest.spyOn(inventoryService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'gin', amount: 1, unit: 'part' }
    ]);
    
    await expect(inventoryService.prepareCocktail('negroni_id', 1, { totalVolumeMl: 0 }))
      .rejects
      .toThrow('totalVolumeMl must be greater than 0');
    
    await expect(inventoryService.prepareCocktail('negroni_id', 1, { totalVolumeMl: -50 }))
      .rejects
      .toThrow('totalVolumeMl must be greater than 0');
  });

  it('should handle mixed unit cocktails (parts + absolute)', async () => {
    const inventoryService = new UserInventoryService();
    
    // Cocktail: 1 part Gin, 1 part Vermouth, 2 dashes Orange Bitters (absolute)
    jest.spyOn(inventoryService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'gin', amount: 1, unit: 'part' },
      { ingredientId: 'vermouth', amount: 1, unit: 'part' },
      { ingredientId: 'orange_bitters', amount: 2, unit: 'dash' }
    ]);
    
    jest.spyOn(inventoryService, 'getInventoryQuantity').mockResolvedValue(500);
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    
    // Prepare 120ml total for the parts
    await inventoryService.prepareCocktail('martini_id', 1, { totalVolumeMl: 120 });
    
    // Gin: (1/2) * 120 = 60ml
    // Vermouth: (1/2) * 120 = 60ml
    // Orange Bitters: 2 dashes (absolute, not scaled)
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'gin', 60);
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'vermouth', 60);
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'orange_bitters', 2);
  });

  it('should calculate required total parts for validation', async () => {
    const inventoryService = new UserInventoryService();
    
    // Cocktail with parts
    jest.spyOn(inventoryService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'gin', amount: 1, unit: 'part' },
      { ingredientId: 'campari', amount: 1, unit: 'part' },
      { ingredientId: 'vermouth', amount: 1, unit: 'part' }
    ]);
    
    const result = await inventoryService.validatePartBasedCocktail('negroni_id');
    
    expect(result.totalParts).toBe(3);
    expect(result.requiresTotalVolume).toBe(true);
  });

  it('should handle serving size scaling with parts', async () => {
    const inventoryService = new UserInventoryService();
    
    jest.spyOn(inventoryService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'gin', amount: 1, unit: 'part' },
      { ingredientId: 'vermouth', amount: 1, unit: 'part' }
    ]);
    
    jest.spyOn(inventoryService, 'getInventoryQuantity').mockResolvedValue(1000);
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    
    // Prepare 4 servings, 60ml total per serving
    await inventoryService.prepareCocktail('martini_id', 4, { totalVolumeMl: 60 });
    
    // Total volume: 4 * 60ml = 240ml
    // Each part: 240ml / 2 = 120ml per ingredient
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'gin', 120);
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'vermouth', 120);
  });

  it('should convert part-based cocktails to absolute for makeability check', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Part-based cocktail
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'gin', amount: 1, unit: 'part' },
      { ingredientId: 'vermouth', amount: 1, unit: 'part' }
    ]);
    
    // User has 100ml each
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'gin', quantity: 100 },
      { ingredientId: 'vermouth', quantity: 100 }
    ]);
    
    // Check makeability for 120ml total drink
    const result = await makeableService.checkMakeable('martini_id', 1, { totalVolumeMl: 120 });
    
    // Requires 60ml each (120ml total / 2 parts)
    expect(result.isMakeable).toBe(true);
    expect(result.requiredAmounts[0].amount).toBe(60);
    expect(result.requiredAmounts[1].amount).toBe(60);
  });
});
```

**Example TDD for Hard Delete Undo Edge Case (UC 4.10):**
```typescript
describe('Cocktail Preparation - Hard Delete Undo Edge Case', () => {
  it('should recreate an inventory row if the ingredient was hard-deleted between preparation and undo', async () => {
    const inventoryService = new UserInventoryService();
    const preparationService = new CocktailPreparationService();
    
    // Mock preparation transaction
    const preparationTx = {
      id: 'tx-123',
      userId: 'user123',
      cocktailId: 'mojito-123',
      servings: 1,
      ingredients: [
        { ingredientId: 'rum-123', amount: 2, unit: 'oz' },
        { ingredientId: 'mint-456', amount: 10, unit: 'leaves' }
      ],
      createdAt: new Date(Date.now() - 5 * 60000) // 5 minutes ago
    };
    
    // Mock that rum ingredient row was hard-deleted after preparation
    jest.spyOn(inventoryService.inventoryRepo, 'findOne')
      .mockImplementation(async (options) => {
        const ingredientId = options.where.ingredientId;
        if (ingredientId === 'rum-123') {
          return null; // Row was deleted
        }
        if (ingredientId === 'mint-456') {
          return { id: 'inv-mint', userId: 'user123', ingredientId: 'mint-456', quantity: 50 };
        }
        return null;
      });
    
    // Mock create for recreated row
    const createSpy = jest.spyOn(inventoryService.inventoryRepo, 'create');
    const saveSpy = jest.spyOn(inventoryService.inventoryRepo, 'save');
    
    // Mock findOne for transaction
    jest.spyOn(preparationService.transactionRepo, 'findOne').mockResolvedValue(preparationTx);
    
    preparationService.inventoryService = inventoryService;
    
    // Attempt undo
    await preparationService.undoPreparation('tx-123');
    
    // Should recreate the deleted rum row
    expect(createSpy).toHaveBeenCalledWith({
      userId: 'user123',
      ingredientId: 'rum-123',
      quantity: 2, // Restored amount
      unit: 'oz',
      baseUnit: 'ml' // Should infer from ingredient catalog
    });
    
    // Should save the recreated row
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
      ingredientId: 'rum-123',
      userId: 'user123'
    }));
    
    // Should also restore the existing mint row (increment)
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
      ingredientId: 'mint-456',
      quantity: 60 // 50 + 10
    }));
  });

  it('should fetch ingredient details from catalog when recreating deleted row', async () => {
    const inventoryService = new UserInventoryService();
    const ingredientService = new IngredientService();
    
    // Mock ingredient catalog lookup
    jest.spyOn(ingredientService, 'getIngredientById').mockResolvedValue({
      id: 'rum-123',
      name: 'White Rum',
      baseUnit: 'ml',
      unitType: 'volume'
    });
    
    inventoryService.ingredientService = ingredientService;
    
    // Mock preparation with deleted ingredient
    const preparationTx = {
      userId: 'user123',
      ingredients: [{ ingredientId: 'rum-123', amount: 2, unit: 'oz' }]
    };
    
    // Mock deleted row
    jest.spyOn(inventoryService.inventoryRepo, 'findOne').mockResolvedValue(null);
    
    const createSpy = jest.spyOn(inventoryService.inventoryRepo, 'create');
    
    await inventoryService.restoreInventory(preparationTx);
    
    // Should use catalog data for recreated row
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      ingredientId: 'rum-123',
      baseUnit: 'ml', // From catalog
      unitType: 'volume' // From catalog
    }));
  });

  it('should handle unit conversion when recreating deleted inventory row', async () => {
    const inventoryService = new UserInventoryService();
    const unitConverter = new UnitConverterService();
    
    // Mock preparation with different unit than base unit
    const preparationTx = {
      userId: 'user123',
      ingredients: [{ ingredientId: 'rum-123', amount: 2, unit: 'oz' }]
    };
    
    // Mock ingredient with ml base unit
    jest.spyOn(inventoryService.ingredientService, 'getIngredientById').mockResolvedValue({
      id: 'rum-123',
      baseUnit: 'ml'
    });
    
    // Mock unit conversion
    jest.spyOn(unitConverter, 'convert').mockReturnValue(59.147); // 2 oz = 59.147 ml
    
    inventoryService.unitConverter = unitConverter;
    
    // Mock deleted row
    jest.spyOn(inventoryService.inventoryRepo, 'findOne').mockResolvedValue(null);
    
    const createSpy = jest.spyOn(inventoryService.inventoryRepo, 'create');
    
    await inventoryService.restoreInventory(preparationTx);
    
    // Should convert oz to ml for storage
    expect(unitConverter.convert).toHaveBeenCalledWith(2, 'oz', 'ml');
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 59.147, // Converted amount
      unit: 'ml' // Base unit
    }));
  });

  it('should handle batch preparation undo with multiple deleted ingredients', async () => {
    const inventoryService = new UserInventoryService();
    
    // Mock batch preparation (4 servings)
    const preparationTx = {
      userId: 'user123',
      servings: 4,
      ingredients: [
        { ingredientId: 'rum-123', amount: 2, unit: 'oz' }, // 8 oz total
        { ingredientId: 'lime-456', amount: 1, unit: 'piece' } // 4 pieces total
      ]
    };
    
    // Both ingredients were deleted
    jest.spyOn(inventoryService.inventoryRepo, 'findOne').mockResolvedValue(null);
    
    const createSpy = jest.spyOn(inventoryService.inventoryRepo, 'create');
    
    await inventoryService.restoreInventory(preparationTx);
    
    // Should recreate both rows with scaled amounts
    expect(createSpy).toHaveBeenCalledTimes(2);
    
    // Rum: 2 oz * 4 servings = 8 oz total
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      ingredientId: 'rum-123',
      quantity: 8 // Scaled amount
    }));
    
    // Lime: 1 piece * 4 servings = 4 pieces total
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      ingredientId: 'lime-456',
      quantity: 4 // Scaled amount
    }));
  });

  it('should log recreation events for audit trail', async () => {
    const inventoryService = new UserInventoryService();
    const logger = { info: jest.fn() };
    inventoryService.logger = logger;
    
    const preparationTx = {
      userId: 'user123',
      ingredients: [{ ingredientId: 'deleted-123', amount: 1, unit: 'oz' }]
    };
    
    jest.spyOn(inventoryService.inventoryRepo, 'findOne').mockResolvedValue(null);
    jest.spyOn(inventoryService.inventoryRepo, 'create').mockReturnValue({} as any);
    jest.spyOn(inventoryService.inventoryRepo, 'save').mockResolvedValue({} as any);
    
    await inventoryService.restoreInventory(preparationTx);
    
    // Should log recreation event
    expect(logger.info).toHaveBeenCalledWith(
      'Recreated deleted inventory row during undo',
      expect.objectContaining({
        userId: 'user123',
        ingredientId: 'deleted-123',
        amount: 1,
        unit: 'oz'
      })
    );
  });

  it('should handle race condition where row is recreated by another process', async () => {
    const inventoryService = new UserInventoryService();
    
    const preparationTx = {
      userId: 'user123',
      ingredients: [{ ingredientId: 'rum-123', amount: 2, unit: 'oz' }]
    };
    
    // First check: row doesn't exist
    // Second check (after race): row now exists
    let checkCount = 0;
    jest.spyOn(inventoryService.inventoryRepo, 'findOne').mockImplementation(async () => {
      checkCount++;
      if (checkCount === 1) return null; // First check
      return { id: 'existing-row', quantity: 5 }; // Second check (race condition)
    });
    
    // Mock upsert behavior
    const saveSpy = jest.spyOn(inventoryService.inventoryRepo, 'save').mockResolvedValue({} as any);
    
    await inventoryService.restoreInventory(preparationTx);
    
    // Should handle gracefully - either update existing or skip
    expect(saveSpy).toHaveBeenCalled();
  });

  it('should validate foreign key constraints when recreating rows', async () => {
    const inventoryService = new UserInventoryService();
    const ingredientService = new IngredientService();
    
    const preparationTx = {
      userId: 'user123',
      ingredients: [{ ingredientId: 'nonexistent-999', amount: 1, unit: 'oz' }]
    };
    
    // Ingredient doesn't exist in catalog (FK violation)
    jest.spyOn(ingredientService, 'getIngredientById').mockResolvedValue(null);
    
    inventoryService.ingredientService = ingredientService;
    jest.spyOn(inventoryService.inventoryRepo, 'findOne').mockResolvedValue(null);
    
    await expect(inventoryService.restoreInventory(preparationTx))
      .rejects
      .toThrow('Ingredient nonexistent-999 not found in catalog');
  });

  it('should work within the undo transaction boundary', async () => {
    const preparationService = new CocktailPreparationService();
    const inventoryService = new UserInventoryService();
    
    // Mock transaction
    const mockTransaction = jest.fn().mockImplementation(async (callback) => {
      const entityManager = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockResolvedValue({})
      };
      return await callback(entityManager);
    });
    
    jest.spyOn(preparationService.transactionRepo.manager, 'transaction').mockImplementation(mockTransaction);
    
    preparationService.inventoryService = inventoryService;
    
    // Mock preparation transaction
    jest.spyOn(preparationService.transactionRepo, 'findOne').mockResolvedValue({
      id: 'tx-123',
      userId: 'user123',
      ingredients: [{ ingredientId: 'rum-123', amount: 2, unit: 'oz' }]
    });
    
    await preparationService.undoPreparation('tx-123');
    
    // Should execute within transaction
    expect(mockTransaction).toHaveBeenCalled();
  });
});

**Example TDD for External API Cocktail Preparation (UC 4.11):**
```typescript
describe('Cocktail Preparation - External API Recipes (UC 4.11)', () => {
  it('should dynamically map and deduct inventory for external cocktails', async () => {
    const prepService = new CocktailPreparationService();
    const aggregator = new CocktailAggregatorService();
    const inventoryService = new UserInventoryService();

    // 1. Mock external API fetch
    jest.spyOn(aggregator, 'getExternalCocktailDetails').mockResolvedValue({
      id: '11000',
      ingredients: [{ name: 'Light Rum', measure: '2 oz', ingredientId: null }] // Not yet mapped
    });

    // 2. Mock dynamic mapping string -> UUID
    jest.spyOn(prepService.ingredientService, 'resolveBaseIngredient')
      .mockResolvedValue({ id: 'uuid-light-rum' });

    // 3. Mock inventory deduction
    const deductSpy = jest.spyOn(inventoryService, 'deductInventory').mockResolvedValue(true);

    prepService.aggregator = aggregator;
    prepService.inventoryService = inventoryService;

    await prepService.prepareCocktail('11000', 1, 'user123');

    // Verify stock was deducted using the mapped UUID, not the external ID
    expect(deductSpy).toHaveBeenCalledWith('user123', 'uuid-light-rum', expect.any(Number));
  });

  it('should deduct optional garnishes linearly if they exist in inventory', async () => {
    // Test implementation for UC 4.12
  });
});

**Example TDD for External API Failure Edge Case:**
```typescript
describe('Cocktail Preparation - External API Resiliency', () => {
  it('should fail gracefully if external API drops during on-the-fly preparation', async () => {
    const prepService = new CocktailPreparationService();
    const aggregator = new CocktailAggregatorService();
    const inventoryService = new UserInventoryService();

    // Mock TheCocktailDB timing out
    jest.spyOn(aggregator, 'getExternalCocktailDetails')
      .mockRejectedValue(new Error('External API Timeout'));
      
    const deductSpy = jest.spyOn(inventoryService, 'deductInventory');

    prepService.aggregator = aggregator;
    prepService.inventoryService = inventoryService;

    await expect(prepService.prepareCocktail('11000', 1, 'user123'))
      .rejects
      .toThrow('Failed to fetch external recipe details for preparation.');

    // Crucial: Ensure NO inventory was deducted
    expect(deductSpy).not.toHaveBeenCalled();
  });
});

**Example TDD for Synonym Greedy Deduction (UC 4.13):**
```typescript
describe('Cocktail Preparation - Synonym Greedy Deduction', () => {
  it('should split deduction across multiple synonym rows if a single row is insufficient', async () => {
    const prepService = new CocktailPreparationService();
    const inventoryService = new UserInventoryService();
    
    // Setup: Cocktail needs 3oz generic 'Whiskey'
    jest.spyOn(prepService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'whiskey-generic', amount: 3, unit: 'oz', name: 'Whiskey' }
    ]);
    
    // User has 2oz 'Bourbon' and 2oz 'Rye' (both synonyms of 'Whiskey')
    jest.spyOn(inventoryService, 'getSynonymInventory').mockResolvedValue([
      { ingredientId: 'bourbon-123', name: 'Bourbon', quantity: 2, unit: 'oz', baseIngredientId: 'whiskey-generic' },
      { ingredientId: 'rye-456', name: 'Rye', quantity: 2, unit: 'oz', baseIngredientId: 'whiskey-generic' }
    ]);
    
    const deductSpy = jest.spyOn(inventoryService, 'deductInventory').mockResolvedValue(true);
    const logSpy = jest.spyOn(prepService, 'logPreparation').mockResolvedValue({} as any);
    
    prepService.inventoryService = inventoryService;
    
    await prepService.prepareCocktail('cocktail-123', 1, 'user123');
    
    // Expect: Deduct 2oz from Bourbon, 1oz from Rye (or vice versa - greedy algorithm)
    expect(deductSpy).toHaveBeenCalledTimes(2);
    
    // Verify first deduction (largest stock first)
    expect(deductSpy).toHaveBeenCalledWith('user123', 'bourbon-123', 2);
    
    // Verify second deduction (remaining amount)
    expect(deductSpy).toHaveBeenCalledWith('user123', 'rye-456', 1);
    
    // Transaction Log saves both deductions accurately
    expect(logSpy).toHaveBeenCalledWith(
      'user123',
      'cocktail-123',
      1,
      expect.arrayContaining([
        expect.objectContaining({ ingredientId: 'bourbon-123', amount: 2 }),
        expect.objectContaining({ ingredientId: 'rye-456', amount: 1 })
      ])
    );
  });
});
```
```
```