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

**Example TDD for Ratio/Part-based Measurements (UC 3.8):**
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

**Example TDD for Synonym Aggregation for Makeability (UC 3.9):**
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

**Example TDD for Hierarchical Ingredient Satisfaction (UC 3.11):**
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
```
```