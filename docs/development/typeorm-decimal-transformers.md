# TypeORM Decimal Column Transformers

## 🎯 Problem Statement

When TypeORM retrieves PostgreSQL `decimal`/`numeric` columns, it may return them as **strings** instead of JavaScript `number` types. This occurs because:

1. PostgreSQL returns decimal values as strings over the wire
2. JavaScript's `Number` type uses IEEE 754 floating-point (imprecise for decimals)
3. TypeORM defaults to preserving precision by keeping values as strings

**The Issue:** Mathematical operations on string values produce `NaN` or incorrect results:
```typescript
// Without transformer: quantity might be "500.00" (string)
const userQuantity = inventory.quantity; // "500.00"
const requiredAmount = 250; // number

// This fails or produces incorrect results
const canMake = userQuantity >= requiredAmount; // false (string >= number)
const remaining = userQuantity - requiredAmount; // NaN
```

## 🔧 Solution: ColumnNumericTransformer

### Implementation
```typescript
// src/utils/column-numeric.transformer.ts
export class ColumnNumericTransformer {
  /**
   * Convert JavaScript number to database decimal string
   */
  to(data: number): string | null {
    if (data === null || data === undefined) {
      return null;
    }
    return data.toString();
  }

  /**
   * Convert database decimal string to JavaScript number
   */
  from(data: string): number | null {
    if (data === null || data === undefined) {
      return null;
    }
    
    // Parse as float for mathematical operations
    const parsed = parseFloat(data);
    
    // Validate the parse was successful
    if (isNaN(parsed)) {
      throw new Error(`Invalid decimal value from database: ${data}`);
    }
    
    return parsed;
  }
}
```

### Entity Configuration
```typescript
// src/users/entities/user-inventory.entity.ts
import { ColumnNumericTransformer } from '../../utils/column-numeric.transformer';

@Entity('user_inventory')
export class UserInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'decimal',
    precision: 10, // Total digits
    scale: 2,      // Decimal places
    transformer: new ColumnNumericTransformer(), // REQUIRED
  })
  quantity: number;

  @Column({
    type: 'decimal',
    precision: 8,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;
}

// src/cocktails/entities/cocktail-ingredient.entity.ts
@Entity('cocktail_ingredients')
export class CocktailIngredient {
  @Column({
    type: 'decimal',
    precision: 8,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;
}
```

## 📊 Why Decimal(10,2) Not Float

### Precision Requirements
| Use Case | Requirement | Why Decimal |
|----------|-------------|-------------|
| Inventory Tracking | Exact quantities (no rounding) | Financial-grade precision |
| Unit Conversion | Mathematical accuracy | Prevents cumulative errors |
| Recipe Scaling | Proportional calculations | Maintains ratio integrity |

### The Float Problem
```typescript
// Floating-point arithmetic errors
const floatResult = 0.1 + 0.2; // 0.30000000000000004 (WRONG)
const decimalResult = 0.1 + 0.2; // 0.30 (CORRECT with decimal)

// Inventory calculation example
const inventory = 500.00; // ml of vodka
const required = 166.67;  // ml for 3 cocktails

// With float (potential error)
const remainingFloat = inventory - (required * 3); // Might be 0.00999999999999

// With decimal (exact)
const remainingDecimal = inventory - (required * 3); // Exactly 0.00
```

## 🧪 Testing Decimal Transformers

### Unit Tests
```typescript
describe('ColumnNumericTransformer', () => {
  const transformer = new ColumnNumericTransformer();

  test('converts number to string for database', () => {
    expect(transformer.to(123.45)).toBe('123.45');
    expect(transformer.to(0)).toBe('0');
    expect(transformer.to(null)).toBeNull();
  });

  test('converts string to number from database', () => {
    expect(transformer.from('123.45')).toBe(123.45);
    expect(transformer.from('0')).toBe(0);
    expect(transformer.from(null)).toBeNull();
  });

  test('handles edge cases', () => {
    expect(transformer.from('')).toBeNull();
    expect(() => transformer.from('invalid')).toThrow();
  });
});

describe('UserInventory Entity', () => {
  test('quantity is always a number', async () => {
    const inventory = await userInventoryRepository.findOne({
      where: { userId: 'test' }
    });
    
    // This should pass with transformer
    expect(typeof inventory.quantity).toBe('number');
    expect(inventory.quantity).not.toBeNaN();
    
    // Mathematical operations should work
    const half = inventory.quantity / 2;
    expect(typeof half).toBe('number');
    expect(half).not.toBeNaN();
  });
});
```

## 🔄 Migration Strategy

### Existing Projects
1. **Audit**: Find all `decimal`/`numeric` columns without transformers
2. **Create Transformer**: Implement `ColumnNumericTransformer`
3. **Update Entities**: Add transformer to each decimal column
4. **Test**: Verify mathematical operations work correctly
5. **Data Migration**: May need to update existing string values

### New Projects
1. **Include from Start**: Add transformer to all decimal columns
2. **Code Generator**: Create entity template with transformer
3. **Linting Rule**: Enforce transformer usage on decimal columns

## ⚠️ Common Pitfalls

1. **Missing Transformer**: Mathematical operations fail silently
2. **Incorrect Precision**: `decimal(10,2)` vs `decimal(8,4)` based on use case
3. **Null Handling**: Ensure transformer handles null/undefined
4. **Validation**: Add validation for non-numeric strings
5. **Testing**: Always test with edge cases (zero, negative, large numbers)

## 📚 Best Practices

1. **Always Use Transformers** for decimal columns
2. **Consistent Precision**: Use same precision for same data types
3. **Validation Layer**: Validate numbers before saving
4. **Error Handling**: Graceful handling of invalid database values
5. **Documentation**: Comment why transformers are needed

## 🔗 Related Documentation
- [Database Schema](../database/database-schema.md)
- [Unit Conversion & Base Units](../database/database-schema.md#-unit-conversion--base-unit-catalog)
- [Backend Architecture](../architecture/backend-architecture.md)