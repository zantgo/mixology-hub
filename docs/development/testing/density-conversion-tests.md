# Density Conversion Tests

**Example TDD for Density Math (UC 3.24):**
```typescript
describe('UnitConverterService - Density Math', () => {
  it('should convert mass to volume using specific gravity/density', () => {
    const converter = new UnitConverterService();
    
    // Honey density ≈ 1.42 g/ml
    const result = converter.convertMassToVolume(50, 'g', 'ml', 1.42);
    
    // 50g / 1.42 = 35.21ml
    expect(result).toBeCloseTo(35.21, 2);
  });

  it('should convert volume to mass using density', () => {
    const converter = new UnitConverterService();
    
    // Honey density ≈ 1.42 g/ml
    const result = converter.convertVolumeToMass(35.21, 'ml', 'g', 1.42);
    
    // 35.21ml * 1.42 = 50g
    expect(result).toBeCloseTo(50, 2);
  });

  it('should handle density of 1.0 (water-like substances)', () => {
    const converter = new UnitConverterService();
    
    // Water has density 1.0 g/ml
    const massToVolume = converter.convertMassToVolume(100, 'g', 'ml', 1.0);
    const volumeToMass = converter.convertVolumeToMass(100, 'ml', 'g', 1.0);
    
    expect(massToVolume).toBe(100);
    expect(volumeToMass).toBe(100);
  });

  it('should throw error for zero or negative density', () => {
    const converter = new UnitConverterService();
    
    expect(() => converter.convertMassToVolume(100, 'g', 'ml', 0))
      .toThrow('Density must be positive');
    
    expect(() => converter.convertMassToVolume(100, 'g', 'ml', -1.42))
      .toThrow('Density must be positive');
  });

  it('should integrate with ingredient database for automatic density lookup', async () => {
    const converter = new UnitConverterService();
    const ingredientService = new IngredientService();
    
    // Mock ingredient with density
    const honeyIngredient = {
      id: 'honey-123',
      name: 'Honey',
      baseUnit: 'ml',
      density: 1.42,
      unitType: 'volume'
    };
    
    jest.spyOn(ingredientService, 'getIngredientById').mockResolvedValue(honeyIngredient);
    converter.ingredientService = ingredientService;
    
    // Convert 50g of honey to ml using ingredient's density
    const result = await converter.convertWithIngredientDensity(50, 'g', 'ml', 'honey-123');
    
    expect(result).toBeCloseTo(35.21, 2);
    expect(ingredientService.getIngredientById).toHaveBeenCalledWith('honey-123');
  });

  it('should handle unit conversions with density for makeability checks', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Cocktail requires 50g of Honey
    jest.spyOn(makeableService, 'getCocktailRequirements').mockResolvedValue([
      { ingredientId: 'honey-123', amount: 50, unit: 'g' }
    ]);
    
    // User has 100ml of Honey
    jest.spyOn(makeableService, 'getUserInventory').mockResolvedValue([
      { ingredientId: 'honey-123', quantity: 100, unit: 'ml' }
    ]);
    
    // Mock ingredient with density
    const mockIngredient = { id: 'honey-123', density: 1.42, baseUnit: 'ml' };
    jest.spyOn(makeableService.ingredientService, 'getIngredientById')
      .mockResolvedValue(mockIngredient);
    
    const result = await makeableService.checkMakeable('honey_cocktail_id', 1);
    
    // 50g honey = 35.21ml, user has 100ml → makeable
    expect(result.isMakeable).toBe(true);
  });

  it('should handle edge case of very low density ingredients', () => {
    const converter = new UnitConverterService();
    
    // Whipped cream density ≈ 0.5 g/ml
    const result = converter.convertMassToVolume(100, 'g', 'ml', 0.5);
    
    // 100g / 0.5 = 200ml
    expect(result).toBe(200);
  });

  it('should handle edge case of very high density ingredients', () => {
    const converter = new UnitConverterService();
    
    // Molasses density ≈ 1.6 g/ml
    const result = converter.convertMassToVolume(100, 'g', 'ml', 1.6);
    
    // 100g / 1.6 = 62.5ml
    expect(result).toBe(62.5);
  });

  it('should maintain precision for small amounts with density', () => {
    const converter = new UnitConverterService();
    
    // Small amount of honey
    const result = converter.convertMassToVolume(0.5, 'g', 'ml', 1.42);
    
    // 0.5g / 1.42 = 0.3521ml
    expect(result).toBeCloseTo(0.3521, 4);
  });

  it('should validate that density conversions are reversible', () => {
    const converter = new UnitConverterService();
    const density = 1.42;
    const originalMass = 50;
    
    // Convert mass to volume
    const volume = converter.convertMassToVolume(originalMass, 'g', 'ml', density);
    
    // Convert volume back to mass
    const mass = converter.convertVolumeToMass(volume, 'ml', 'g', density);
    
    // Should get original mass back (within floating point tolerance)
    expect(mass).toBeCloseTo(originalMass, 10);
  });
});
```