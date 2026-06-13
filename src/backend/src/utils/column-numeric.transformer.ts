import { Decimal } from 'decimal.js';
import { ValueTransformer } from 'typeorm';

export class ColumnNumericTransformer implements ValueTransformer {
  to(data: Decimal | number | null | undefined): string | null {
    if (data === null || data === undefined) {
      return null;
    }
    if (data instanceof Decimal) {
      return data.toString();
    }
    return data.toString();
  }

  from(data: string | null | undefined): Decimal | null {
    if (data === null || data === undefined) {
      return null;
    }
    try {
      return new Decimal(data);
    } catch {
      throw new Error(`Invalid decimal value from database: ${data}`);
    }
  }
}
