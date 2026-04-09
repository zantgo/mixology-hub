# Rinse Ingredient Tests

**Example TDD for Zero-Volume Rinse Edge Case:**
```typescript
describe('Cocktail Preparation - Zero-Volume Rinse Edge Case', () => {
  it('should validate presence but NOT deduct volume for "rinse" ingredients', async () => {
    const inventoryService = new UserInventoryService();
    
    // User has exactly 10ml of Absinthe
    jest.spyOn(inventoryService, 'getInventoryQuantity').mockResolvedValue(10);
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    
    // Cocktail requires an Absinthe Rinse
    await inventoryService.prepareCocktail('sazerac_id', 1, [
      { ingredientId: 'absinthe', amount: null, unit: 'rinse' }
    ]);
    
    // Transaction succeeds (because they HAVE absinthe)
    // BUT deductInventory is NEVER called for Absinthe
    expect(mockDeduct).not.toHaveBeenCalledWith(expect.any(String), 'absinthe', expect.any(Number));
  });

  it('should fail preparation if rinse ingredient is missing', async () => {
    const inventoryService = new UserInventoryService();
    
    // User has NO Absinthe
    jest.spyOn(inventoryService, 'getInventoryQuantity').mockResolvedValue(0);
    
    // Cocktail requires an Absinthe Rinse
    await expect(inventoryService.prepareCocktail('sazerac_id', 1, [
      { ingredientId: 'absinthe', amount: null, unit: 'rinse' }
    ])).rejects.toThrow('Missing required rinse ingredient: absinthe');
  });

  it('should handle mixed rinse and regular ingredients', async () => {
    const inventoryService = new UserInventoryService();
    
    // User has Absinthe (rinse) and Whiskey (regular)
    jest.spyOn(inventoryService, 'getInventoryQuantity')
      .mockImplementation(async (_, ingredientId) => {
        if (ingredientId === 'absinthe') return 10;
        if (ingredientId === 'whiskey') return 100;
        return 0;
      });
    
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    
    // Sazerac: Whiskey (regular) + Absinthe Rinse
    await inventoryService.prepareCocktail('sazerac_id', 1, [
      { ingredientId: 'whiskey', amount: 2, unit: 'oz' },
      { ingredientId: 'absinthe', amount: null, unit: 'rinse' }
    ]);
    
    // Should deduct whiskey but NOT absinthe
    expect(mockDeduct).toHaveBeenCalledTimes(1);
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'whiskey', 2);
    expect(mockDeduct).not.toHaveBeenCalledWith(expect.any(String), 'absinthe', expect.any(Number));
  });

  it('should log rinse usage without deduction', async () => {
    const preparationService = new CocktailPreparationService();
    const logger = { info: jest.fn() };
    preparationService.logger = logger;
    
    const inventoryService = {
      getInventoryQuantity: jest.fn().mockResolvedValue(10),
      deductInventory: jest.fn().mockResolvedValue(true)
    };
    
    preparationService.inventoryService = inventoryService;
    
    await preparationService.prepareCocktail('sazerac_id', 1, 'user123', [
      { ingredientId: 'absinthe', amount: null, unit: 'rinse' }
    ]);
    
    // Should log rinse usage
    expect(logger.info).toHaveBeenCalledWith(
      'Rinse ingredient used',
      expect.objectContaining({
        ingredientId: 'absinthe',
        userId: 'user123',
        action: 'rinse_only'
      })
    );
  });

  it('should handle rinse in batch preparation', async () => {
    const inventoryService = new UserInventoryService();
    
    // User has Absinthe
    jest.spyOn(inventoryService, 'getInventoryQuantity').mockResolvedValue(10);
    const mockDeduct = jest.spyOn(inventoryService, 'deductInventory');
    
    // Prepare 3 Sazeracs
    await inventoryService.prepareCocktail('sazerac_id', 3, [
      { ingredientId: 'whiskey', amount: 2, unit: 'oz' },
      { ingredientId: 'absinthe', amount: null, unit: 'rinse' }
    ]);
    
    // Should deduct whiskey for 3 servings (6oz total)
    // Should NOT deduct absinthe (rinse doesn't scale)
    expect(mockDeduct).toHaveBeenCalledTimes(1);
    expect(mockDeduct).toHaveBeenCalledWith(expect.any(String), 'whiskey', 6);
  });

  it('should validate rinse ingredient exists in catalog', async () => {
    const preparationService = new CocktailPreparationService();
    const ingredientService = new IngredientService();
    
    // Mock ingredient service to validate rinse ingredient
    jest.spyOn(ingredientService, 'getIngredientById')
      .mockResolvedValue({ id: 'absinthe', name: 'Absinthe', baseUnit: 'ml' });
    
    preparationService.ingredientService = ingredientService;
    
    const inventoryService = {
      getInventoryQuantity: jest.fn().mockResolvedValue(10),
      deductInventory: jest.fn().mockResolvedValue(true)
    };
    
    preparationService.inventoryService = inventoryService;
    
    // Should validate absinthe exists in catalog
    await preparationService.prepareCocktail('sazerac_id', 1, 'user123', [
      { ingredientId: 'absinthe', amount: null, unit: 'rinse' }
    ]);
    
    expect(ingredientService.getIngredientById).toHaveBeenCalledWith('absinthe');
  });

  it('should handle undo for cocktails with rinse ingredients', async () => {
    const preparationService = new CocktailPreparationService();
    
    const mockLog = {
      id: 'log-123',
      userId: 'user123',
      cocktailId: 'sazerac_id',
      ingredients: [
        { ingredientId: 'whiskey', amount: 2, unit: 'oz', type: 'regular' },
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
    
    // Should restore whiskey but NOT absinthe (rinse wasn't deducted)
    expect(inventoryService.restoreInventory).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: [
          { ingredientId: 'whiskey', amount: 2, unit: 'oz' }
          // absinthe not included in restore
        ]
      })
    );
  });
});
```