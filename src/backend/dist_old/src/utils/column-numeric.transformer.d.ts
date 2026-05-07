import { Decimal } from 'decimal.js';
import { ValueTransformer } from 'typeorm';
export declare class ColumnNumericTransformer implements ValueTransformer {
    to(data: Decimal | number | null | undefined): string | null;
    from(data: string | null | undefined): Decimal | null;
}
