# TDD Examples

**Example TDD Workflow for `UnitConverterService`:**
```typescript
// 1. RED: Write failing test
it('should convert ounces to milliliters', () => {
  const converter = new UnitConverterService();
  expect(converter.convert(1, 'oz', 'ml')).toBe(29.5735);
});

// 2. GREEN: Implement minimal solution
class UnitConverterService {
  convert(amount: number, from: string, to: string): number {
    if (from === 'oz' && to === 'ml') {
      return amount * 29.5735;
    }
    throw new Error('Conversion not implemented');
  }
}

// 3. REFACTOR: Improve implementation
class UnitConverterService {
  private conversions = {
    oz: { ml: 29.5735, cl: 2.95735 },
    ml: { oz: 0.033814 }
  };
  
  convert(amount: number, from: string, to: string): number {
    const rate = this.conversions[from]?.[to];
    if (!rate) throw new Error(`Unsupported conversion: ${from}→${to}`);
    return amount * rate;
  }
}
```