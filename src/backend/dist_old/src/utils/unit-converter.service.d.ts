import { Decimal } from 'decimal.js';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
export declare class UnitConverterService {
    private readonly conversionFactors;
    convert(quantity: Decimal | number, fromUnit: string, toUnit: string, ingredient?: Ingredient): Decimal;
    hasEnoughStock(stockQuantity: Decimal | number, stockUnit: string, requiredAmount: Decimal | number, requiredUnit: string, ingredient?: Ingredient): boolean;
    private convertMassToVolume;
    private convertVolumeToMass;
    private convertWithinCategory;
    private isMassUnit;
    private isVolumeUnit;
}
