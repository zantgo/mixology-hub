# Makeable Intelligence Tests

**Example TDD for Incompatible Units (UC 3.4):**
```typescript
describe('UnitConverterService - Incompatible Units', () => {
  it('should throw error for volume to mass conversion without density', () => {
    const converter = new UnitConverterService();
    
    expect(() => converter.convert(100, 'ml', 'g'))
      .toThrow('IncompatibleUnitError: Cannot convert volume to mass without density');
  });

  it('should allow volume to volume conversions', () => {
    const converter = new UnitConverterService();
    const result = converter.convert(2, 'oz', 'ml');
    expect(result).toBeCloseTo(59.15, 2);
  });
});
```

**Example TDD for Optional Ingredients (UC 3.5):**
```typescript
describe('MakeableCocktailsService - Optional Ingredients', () => {
  it('should include cocktails when only optional ingredients are missing', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // User has Gin and Tonic, but no Lime
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'gin', quantity: 1000 },
      { ingredientId: 'tonic', quantity: 1000 }
    ]);
    
    const makeable = await makeableService.getMakeableCocktails('user123');
    
    // Cocktail should be present because Lime is flagged is_optional = true
    const ginTonic = makeable.find(c => c.name === 'Gin & Tonic');
    expect(ginTonic).toBeDefined();
  });

  it('should exclude cocktails when required ingredients are missing', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // User has Lime but no Gin (required)
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'lime', quantity: 100 }
    ]);
    
    const makeable = await makeableService.getMakeableCocktails('user123');
    const ginTonic = makeable.find(c => c.name === 'Gin & Tonic');
    expect(ginTonic).toBeUndefined();
  });
});
```

**Example TDD for "Almost Makeable" (UC 3.6):**
```typescript
describe('MakeableCocktailsService - Missing 1 Ingredient', () => {
  it('should flag cocktails that are missing exactly one ingredient', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // User has Tequila but no Lime
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'tequila', quantity: 500 }
    ]);
    
    const results = await makeableService.getAlmostMakeableCocktails('user123');
    const margarita = results.find(c => c.name === 'Margarita');
    
    expect(margarita).toBeDefined();
    expect(margarita.missingIngredients).toEqual(['Lime']);
  });

  it('should not include cocktails missing multiple ingredients', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // User has only Tequila (missing Triple Sec AND Lime)
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'tequila', quantity: 500 }
    ]);
    
    const results = await makeableService.getAlmostMakeableCocktails('user123');
    const margarita = results.find(c => c.name === 'Margarita');
    
    // Should not appear in "almost makeable" if missing >1 ingredient
    expect(margarita).toBeUndefined();
  });
});
```

**Example TDD for Serving Size Scaling (UC 3.7):**
```typescript
describe('MakeableCocktailsService - Serving Size Scaling', () => {
  it('should scale ingredient requirements by serving size', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // User has 200ml of vodka
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'vodka', quantity: 200 }
    ]);
    
    // Mock cocktail requires 50ml per serving
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'vodka', amount: 50, unit: 'ml' }
    ]);
    
    // Check makeability for 4 servings (requires 200ml total)
    const result = await makeableService.checkMakeable('cocktail123', 4);
    expect(result.isMakeable).toBe(true);
    expect(result.requiredAmounts).toEqual([{ ingredientId: 'vodka', amount: 200 }]);
  });

  it('should fail makeability check when scaled requirements exceed inventory', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // User has only 150ml of vodka
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'vodka', quantity: 150 }
    ]);
    
    // Cocktail requires 50ml per serving
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'vodka', amount: 50, unit: 'ml' }
    ]);
    
    // 4 servings requires 200ml, but user only has 150ml
    const result = await makeableService.checkMakeable('cocktail123', 4);
    expect(result.isMakeable).toBe(false);
    expect(result.missingAmounts).toEqual([{ ingredientId: 'vodka', amount: 50 }]);
  });
});

**Example TDD for Scaling-Induced "Almost Makeable" Transition (UC 3.8):**
```typescript
describe('MakeableCocktailsService - Scaling-Induced Almost Makeable', () => {
  it('should transition from Makeable to Almost Makeable when scaling exceeds inventory', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // User has 4oz of Vodka
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'vodka', quantity: 4, unit: 'oz' }
    ]);
    
    // Martini requires 2oz Vodka per serving
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'vodka', amount: 2, unit: 'oz' }
    ]);
    
    // Check makeability for 1 serving (requires 2oz, has 4oz) - Makeable
    const result1 = await makeableService.checkMakeable('martini_id', 1);
    expect(result1.isMakeable).toBe(true);
    expect(result1.category).toBe('makeable');
    
    // Check makeability for 3 servings (requires 6oz, has 4oz) - Almost Makeable
    const result3 = await makeableService.checkMakeable('martini_id', 3);
    expect(result3.isMakeable).toBe(false);
    expect(result3.category).toBe('almost_makeable');
    expect(result3.missingAmounts[0].amount).toBe(2); // Missing 2oz
    expect(result3.missingAmounts[0].ingredientId).toBe('vodka');
  });

  it('should provide clear feedback on missing amounts for scaled servings', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // User has limited ingredients
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'gin', quantity: 3, unit: 'oz' },
      { ingredientId: 'vermouth', quantity: 1, unit: 'oz' }
    ]);
    
    // Martini requires 2oz Gin, 0.5oz Vermouth per serving
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'gin', amount: 2, unit: 'oz' },
      { ingredientId: 'vermouth', amount: 0.5, unit: 'oz' }
    ]);
    
    // Check 2 servings (requires 4oz Gin, 1oz Vermouth)
    const result = await makeableService.checkMakeable('martini_id', 2);
    
    expect(result.category).toBe('almost_makeable');
    expect(result.missingAmounts).toHaveLength(2);
    expect(result.missingAmounts.find(m => m.ingredientId === 'gin')?.amount).toBe(1); // Missing 1oz Gin
    expect(result.missingAmounts.find(m => m.ingredientId === 'vermouth')?.amount).toBe(0); // Has enough Vermouth
    expect(result.userMessage).toContain('Missing 1oz Gin for 2 servings');
  });

  it('should handle complex cocktails with multiple ingredients when scaling', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // User inventory
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'rum', quantity: 8, unit: 'oz' },
      { ingredientId: 'lime_juice', quantity: 4, unit: 'oz' },
      { ingredientId: 'simple_syrup', quantity: 2, unit: 'oz' },
      { ingredientId: 'mint', quantity: 10, unit: 'leaves' }
    ]);
    
    // Mojito requires per serving: 2oz Rum, 1oz Lime, 0.5oz Simple, 5 Mint leaves
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'rum', amount: 2, unit: 'oz' },
      { ingredientId: 'lime_juice', amount: 1, unit: 'oz' },
      { ingredientId: 'simple_syrup', amount: 0.5, unit: 'oz' },
      { ingredientId: 'mint', amount: 5, unit: 'leaves' }
    ]);
    
    // Test different serving sizes
    const testCases = [
      { servings: 1, expectedCategory: 'makeable' }, // Has enough for 1
      { servings: 2, expectedCategory: 'makeable' }, // Has enough for 2
      { servings: 3, expectedCategory: 'almost_makeable' }, // Missing Simple Syrup (needs 1.5oz, has 2oz) - actually has enough
      { servings: 4, expectedCategory: 'almost_makeable' }, // Missing Simple Syrup (needs 2oz, has 2oz) - borderline
      { servings: 5, expectedCategory: 'almost_makeable' }  // Missing multiple ingredients
    ];
    
    for (const testCase of testCases) {
      const result = await makeableService.checkMakeable('mojito_id', testCase.servings);
      expect(result.category).toBe(testCase.expectedCategory);
    }
  });

  it('should dynamically recalculate as inventory changes', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Mock inventory that can change
    let mockInventory = [
      { ingredientId: 'vodka', quantity: 4, unit: 'oz' }
    ];
    
    jest.spyOn(makeableService, 'getUserInventory').mockImplementation(async () => mockInventory);
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'vodka', amount: 2, unit: 'oz' }
    ]);
    
    // Initially: 4oz vodka, 3 servings requires 6oz - Almost Makeable
    const initialResult = await makeableService.checkMakeable('martini_id', 3);
    expect(initialResult.category).toBe('almost_makeable');
    
    // User adds 2oz vodka (now 6oz total)
    mockInventory = [{ ingredientId: 'vodka', quantity: 6, unit: 'oz' }];
    
    // Now: 6oz vodka, 3 servings requires 6oz - Makeable
    const updatedResult = await makeableService.checkMakeable('martini_id', 3);
    expect(updatedResult.category).toBe('makeable');
  });

  it('should maintain accurate categorization across serving size changes', async () => {
    const makeableService = new MakeableCocktailsService();
    
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'tequila', quantity: 6, unit: 'oz' },
      { ingredientId: 'triple_sec', quantity: 3, unit: 'oz' },
      { ingredientId: 'lime_juice', quantity: 2, unit: 'oz' }
    ]);
    
    // Margarita requires per serving: 2oz Tequila, 1oz Triple Sec, 1oz Lime
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'tequila', amount: 2, unit: 'oz' },
      { ingredientId: 'triple_sec', amount: 1, unit: 'oz' },
      { ingredientId: 'lime_juice', amount: 1, unit: 'oz' }
    ]);
    
    const results = await Promise.all([
      makeableService.checkMakeable('margarita_id', 1),
      makeableService.checkMakeable('margarita_id', 2),
      makeableService.checkMakeable('margarita_id', 3)
    ]);
    
    // 1 serving: Makeable (has all ingredients)
    expect(results[0].category).toBe('makeable');
    
    // 2 servings: Almost Makeable (missing Lime: needs 2oz, has 2oz - borderline)
    expect(results[1].category).toBe('makeable'); // Actually has exactly enough
    
    // 3 servings: Almost Makeable (missing Lime: needs 3oz, has 2oz)
    expect(results[2].category).toBe('almost_makeable');
    expect(results[2].missingAmounts.find(m => m.ingredientId === 'lime_juice')?.amount).toBe(1);
  });
});
```

**Example TDD for Ratio/Part-based Measurements (UC 3.9):**
```typescript
describe('MeasureParserService - Ratio/Part-based Measurements', () => {
  it('should handle "part" as a unit requiring base volume input', () => {
    const parser = new MeasureParserService();
    
    // Recipe uses "1 part Campari, 1 part Gin"
    const parsed = parser.parse('1 part Campari');
    
    expect(parsed.unit).toBe('part');
    expect(parsed.amount).toBe(1);
    expect(parsed.requiresBaseVolume).toBe(true);
  });

  it('should calculate absolute amounts when base volume is provided', () => {
    const parser = new MeasureParserService();
    
    // User wants a 150ml drink with "1 part Campari, 1 part Gin"
    const absoluteAmount = parser.convertPartToAbsolute(1, 'part', 150, 2); // 2 total parts
    
    // 150ml total / 2 parts = 75ml per part
    expect(absoluteAmount).toBe(75);
  });

  it('should flag drinks with part-based measurements for user clarification', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail uses part-based measurements
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'campari', amount: 1, unit: 'part' },
      { ingredientId: 'gin', amount: 1, unit: 'part' }
    ]);
    
    const result = await makeableService.checkMakeable('negroni_id', 1);
    
    expect(result.isMakeable).toBe(false);
    expect(result.requiresUserInput).toBe(true);
    expect(result.userInputRequired).toContain('base volume');
  });
});
```

**Example TDD for Synonym Aggregation for Makeability (UC 3.10):**
```typescript
describe('MakeableCocktailsService - Synonym Aggregation', () => {
  it('should aggregate quantities of all synonym ingredients to determine makeability', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail requires 60ml of 'orange liqueur'
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'orange_liqueur', amount: 60, unit: 'ml' }
    ]);
    
    // User has 30ml Triple Sec and 40ml Cointreau
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'triple_sec', quantity: 30 },
      { ingredientId: 'cointreau', quantity: 40 }
    ]);
    
    // Mock the synonym resolver
    jest.spyOn(makeableService.ingredientService, 'resolveBaseIngredient')
      .mockImplementation((id) => id === 'triple_sec' || id === 'cointreau' ? 'orange_liqueur' : id);

    const result = await makeableService.checkMakeable('cocktail123', 1);
    
    // 30 + 40 = 70 >= 60. Should be true.
    expect(result.isMakeable).toBe(true);
  });

  it('should handle synonyms across multiple ingredient categories', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail requires 50ml of 'whiskey'
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'whiskey', amount: 50, unit: 'ml' }
    ]);
    
    // User has 30ml Bourbon and 25ml Rye (both whiskey synonyms)
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'bourbon', quantity: 30 },
      { ingredientId: 'rye', quantity: 25 }
    ]);
    
    jest.spyOn(makeableService.ingredientService, 'resolveBaseIngredient')
      .mockImplementation((id) => id === 'bourbon' || id === 'rye' ? 'whiskey' : id);

    const result = await makeableService.checkMakeable('old_fashioned_id', 1);
    
    // 30 + 25 = 55 >= 50. Should be true.
    expect(result.isMakeable).toBe(true);
  });
});

**Example TDD for Hierarchical Ingredient Satisfaction (UC 3.12):**
```typescript
describe('MakeableCocktailsService - Hierarchical Ingredient Satisfaction', () => {
  it('should satisfy generic ingredient requirements with specific sub-types', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail requires generic "Whiskey"
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'whiskey', amount: 60, unit: 'ml' }
    ]);
    
    // User has Bourbon (a type of Whiskey)
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'bourbon', quantity: 100, unit: 'ml' }
    ]);
    
    // Mock hierarchy resolution
    jest.spyOn(makeableService.ingredientService, 'resolveHierarchy')
      .mockImplementation((id) => {
        if (id === 'bourbon') return ['whiskey']; // Bourbon IS-A Whiskey
        return [];
      });
    
    const result = await makeableService.checkMakeable('old_fashioned_id', 1);
    
    expect(result.isMakeable).toBe(true);
    expect(result.usedSubstitutions).toEqual([{
      required: 'whiskey',
      used: 'bourbon',
      relationship: 'is_a'
    }]);
  });

  it('should handle multi-level ingredient hierarchies', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail requires "Spirit"
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'spirit', amount: 50, unit: 'ml' }
    ]);
    
    // User has Vodka (Spirit → Clear Spirit → Vodka)
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'vodka', quantity: 100, unit: 'ml' }
    ]);
    
    jest.spyOn(makeableService.ingredientService, 'resolveHierarchy')
      .mockImplementation((id) => {
        if (id === 'vodka') return ['clear_spirit', 'spirit']; // Vodka IS-A Clear Spirit IS-A Spirit
        return [];
      });
    
    const result = await makeableService.checkMakeable('cocktail_id', 1);
    
    expect(result.isMakeable).toBe(true);
  });

  it('should not allow reverse substitution (generic for specific)', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail requires specific "Bourbon"
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'bourbon', amount: 60, unit: 'ml' }
    ]);
    
    // User only has generic "Whiskey"
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'whiskey', quantity: 100, unit: 'ml' }
    ]);
    
    jest.spyOn(makeableService.ingredientService, 'resolveHierarchy')
      .mockImplementation((id) => {
        if (id === 'whiskey') return []; // Whiskey is NOT a Bourbon (can't substitute up)
        return [];
      });
    
    const result = await makeableService.checkMakeable('bourbon_cocktail_id', 1);
    
    expect(result.isMakeable).toBe(false);
    expect(result.missingIngredients).toContain('bourbon');
  });

  it('should combine hierarchical and synonym resolution', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail requires "Orange Liqueur"
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'orange_liqueur', amount: 30, unit: 'ml' }
    ]);
    
    // User has Cointreau (synonym) and Grand Marnier (hierarchical: orange_liqueur → brandy_based → grand_marnier)
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'cointreau', quantity: 20, unit: 'ml' },
      { ingredientId: 'grand_marnier', quantity: 20, unit: 'ml' }
    ]);
    
    // Mock both synonym and hierarchy resolution
    jest.spyOn(makeableService.ingredientService, 'resolveBaseIngredient')
      .mockImplementation((id) => id === 'cointreau' ? 'orange_liqueur' : id);
    
    jest.spyOn(makeableService.ingredientService, 'resolveHierarchy')
      .mockImplementation((id) => {
        if (id === 'grand_marnier') return ['brandy_based_orange_liqueur', 'orange_liqueur'];
        return [];
      });
    
    const result = await makeableService.checkMakeable('margarita_id', 1);
    
    // 20 + 20 = 40 >= 30
    expect(result.isMakeable).toBe(true);
  });

  it('should prioritize exact matches over hierarchical substitutions', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail requires "Whiskey"
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'whiskey', amount: 60, unit: 'ml' }
    ]);
    
    // User has both generic Whiskey AND specific Bourbon
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'whiskey', quantity: 30, unit: 'ml' },
      { ingredientId: 'bourbon', quantity: 40, unit: 'ml' }
    ]);
    
    jest.spyOn(makeableService.ingredientService, 'resolveHierarchy')
      .mockImplementation((id) => {
        if (id === 'bourbon') return ['whiskey'];
        return [];
      });
    
    const result = await makeableService.checkMakeable('cocktail_id', 1);
    
    // Should use exact match first (30ml whiskey), then hierarchical (10ml bourbon)
    expect(result.isMakeable).toBe(true);
    expect(result.usedAmounts.find(a => a.ingredientId === 'whiskey')?.amount).toBe(30);
    expect(result.usedAmounts.find(a => a.ingredientId === 'bourbon')?.amount).toBe(10);
  });
});
```

**Example TDD for Makeability with Un-tracked Garnishes (UC 3.11):**
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
```

**Example TDD for Recursive Hierarchy Infinite Loop Prevention (UC 3.13):**
```typescript
describe('IngredientService - Circular Reference Detection', () => {
  it('should detect and prevent circular references in ingredient hierarchy', async () => {
    const ingredientService = new IngredientService();
    
    // Mock circular reference: Bourbon → Whiskey → Bourbon
    jest.spyOn(ingredientService, 'getParentIngredients').mockImplementation(async (id) => {
      if (id === 'bourbon') return ['whiskey'];
      if (id === 'whiskey') return ['bourbon']; // Circular reference!
      return [];
    });
    
    // Should detect circular reference and throw error
    await expect(ingredientService.resolveHierarchy('bourbon'))
      .rejects
      .toThrow('Circular reference detected in ingredient hierarchy: bourbon → whiskey → bourbon');
  });

  it('should track visited nodes to detect circular references', async () => {
    const ingredientService = new IngredientService();
    
    // Mock complex circular reference: A → B → C → A
    jest.spyOn(ingredientService, 'getParentIngredients').mockImplementation(async (id) => {
      if (id === 'ingredient_a') return ['ingredient_b'];
      if (id === 'ingredient_b') return ['ingredient_c'];
      if (id === 'ingredient_c') return ['ingredient_a']; // Circular reference
      return [];
    });
    
    await expect(ingredientService.resolveHierarchy('ingredient_a'))
      .rejects
      .toThrow('Circular reference detected');
  });

  it('should handle self-referential circular references', async () => {
    const ingredientService = new IngredientService();
    
    // Mock self-reference: Vodka → Vodka
    jest.spyOn(ingredientService, 'getParentIngredients').mockResolvedValue(['vodka']); // Vodka is its own parent
    
    await expect(ingredientService.resolveHierarchy('vodka'))
      .rejects
      .toThrow('Circular reference detected: vodka → vodka');
  });

  it('should safely break loops and return valid hierarchy when circular reference detected', async () => {
    const ingredientService = new IngredientService();
    
    // Mock circular reference with some valid hierarchy
    let callCount = 0;
    jest.spyOn(ingredientService, 'getParentIngredients').mockImplementation(async (id) => {
      callCount++;
      if (callCount > 10) {
        throw new Error('Infinite loop detected - too many recursive calls');
      }
      
      if (id === 'bourbon') return ['whiskey', 'spirit']; // Bourbon IS-A Whiskey AND Spirit
      if (id === 'whiskey') return ['bourbon', 'spirit']; // Circular: Whiskey IS-A Bourbon (wrong!)
      if (id === 'spirit') return [];
      return [];
    });
    
    // Should detect circular reference and break
    const result = await ingredientService.resolveHierarchy('bourbon', { maxDepth: 5 });
    
    // Should return partial hierarchy or empty array
    expect(result).toBeDefined();
    expect(result.length).toBeLessThan(10); // Should not have infinite results
  });

  it('should log circular references for database cleanup', async () => {
    const ingredientService = new IngredientService();
    const logger = { error: jest.fn() };
    ingredientService.logger = logger;
    
    jest.spyOn(ingredientService, 'getParentIngredients').mockImplementation(async (id) => {
      if (id === 'tequila') return ['mezcal'];
      if (id === 'mezcal') return ['tequila']; // Circular
      return [];
    });
    
    try {
      await ingredientService.resolveHierarchy('tequila');
    } catch (error) {
      // Should log the circular reference
      expect(logger.error).toHaveBeenCalledWith(
        'Circular reference in ingredient hierarchy',
        expect.objectContaining({
          path: expect.stringContaining('tequila → mezcal → tequila')
        })
      );
    }
  });

  it('should prevent stack overflow with deep circular references', async () => {
    const ingredientService = new IngredientService();
    
    // Mock very deep circular reference that would cause stack overflow
    const deepChain = Array(1000).fill(null).map((_, i) => `ingredient_${i}`);
    let currentIndex = 0;
    
    jest.spyOn(ingredientService, 'getParentIngredients').mockImplementation(async (id) => {
      const match = id.match(/ingredient_(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        // Create circular reference at depth 500
        if (num === 500) return ['ingredient_0']; // Circular back to start
        return [`ingredient_${num + 1}`];
      }
      return [];
    });
    
    // Should detect circular reference before stack overflow
    await expect(ingredientService.resolveHierarchy('ingredient_0', { maxDepth: 100 }))
      .rejects
      .toThrow('Circular reference detected');
  });

  it('should work correctly with valid non-circular hierarchies', async () => {
    const ingredientService = new IngredientService();
    
    // Mock valid hierarchy: Vodka → Clear Spirit → Spirit → Alcoholic Beverage
    jest.spyOn(ingredientService, 'getParentIngredients').mockImplementation(async (id) => {
      if (id === 'vodka') return ['clear_spirit'];
      if (id === 'clear_spirit') return ['spirit'];
      if (id === 'spirit') return ['alcoholic_beverage'];
      if (id === 'alcoholic_beverage') return [];
      return [];
    });
    
    const result = await ingredientService.resolveHierarchy('vodka');
    
    expect(result).toEqual(['clear_spirit', 'spirit', 'alcoholic_beverage']);
    expect(result).not.toContain('vodka'); // Should not include self
  });

  it('should handle mixed valid and circular references gracefully', async () => {
    const ingredientService = new IngredientService();
    
    // Mock: A → B → C (valid), C → D → B (circular: B already visited)
    const hierarchyMap = {
      'ingredient_a': ['ingredient_b'],
      'ingredient_b': ['ingredient_c'],
      'ingredient_c': ['ingredient_d'],
      'ingredient_d': ['ingredient_b'] // Circular back to B
    };
    
    jest.spyOn(ingredientService, 'getParentIngredients').mockImplementation(async (id) => {
      return hierarchyMap[id] || [];
    });
    
    await expect(ingredientService.resolveHierarchy('ingredient_a'))
      .rejects
      .toThrow('Circular reference detected');
  });
});
```
```
```