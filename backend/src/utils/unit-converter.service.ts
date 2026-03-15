import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * Professional service for handling unit conversions.
 * Ensures that inventory depletion logic is mathematically accurate.
 */
@Injectable()
export class UnitConverterService {
  // Conversion factors relative to a base unit (e.g., ml)
  private readonly conversionFactors: Record<string, number> = {
    'ml': 1,
    'oz': 29.57, // 1 oz = 29.57 ml
    'l': 1000,
    'cl': 10,
    'units': 1,
    'g': 1,      // Equivalencia de barra: 1 gramo = 1 ml para cálculos de recetas
    'kg': 1000,
  };

  /**
   * Converts a quantity from one unit to another
   */
  convert(quantity: number, fromUnit: string, toUnit: string): number {
    const from = fromUnit.toLowerCase();
    const to = toUnit.toLowerCase();

    if (!this.conversionFactors[from] || !this.conversionFactors[to]) {
      throw new BadRequestException(`Conversion from ${from} to ${to} is not supported.`);
    }

    const valueInBase = quantity * this.conversionFactors[from];
    return valueInBase / this.conversionFactors[to];
  }

  /**
   * Checks if the user has enough stock for a requirement
   */
  hasEnoughStock(stockQuantity: number, stockUnit: string, requiredAmount: number, requiredUnit: string): boolean {
    try {
      const stockInRequiredUnit = this.convert(stockQuantity, stockUnit, requiredUnit);
      return stockInRequiredUnit >= requiredAmount;
    } catch (e) {
      return false;
    }
  }
}
