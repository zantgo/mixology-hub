import { Injectable, BadRequestException } from '@nestjs/common';
import { Ingredient } from '../ingredients/entities/ingredient.entity';

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
    'g': 1,      // Base unit for weight
    'kg': 1000,
  };

  /**
   * Converts a quantity from one unit to another
   * @param ingredient Optional ingredient for density-based conversions
   */
  convert(quantity: number, fromUnit: string, toUnit: string, ingredient?: Ingredient): number {
    const from = fromUnit.toLowerCase();
    const to = toUnit.toLowerCase();

    // Check if units are supported
    if (!this.conversionFactors[from] || !this.conversionFactors[to]) {
      throw new BadRequestException(`Conversion from ${from} to ${to} is not supported.`);
    }

    // Handle mass-to-volume or volume-to-mass conversions
    if (this.isMassUnit(from) && this.isVolumeUnit(to)) {
      return this.convertMassToVolume(quantity, from, to, ingredient);
    } else if (this.isVolumeUnit(from) && this.isMassUnit(to)) {
      return this.convertVolumeToMass(quantity, from, to, ingredient);
    }

    // Standard conversion within same category (mass-mass or volume-volume)
    const valueInBase = quantity * this.conversionFactors[from];
    return valueInBase / this.conversionFactors[to];
  }

  /**
   * Checks if the user has enough stock for a requirement
   */
  hasEnoughStock(
    stockQuantity: number, 
    stockUnit: string, 
    requiredAmount: number, 
    requiredUnit: string,
    ingredient?: Ingredient
  ): boolean {
    try {
      const stockInRequiredUnit = this.convert(stockQuantity, stockUnit, requiredUnit, ingredient);
      return stockInRequiredUnit >= requiredAmount;
    } catch (e) {
      return false;
    }
  }

  /**
   * Converts mass to volume using ingredient density
   */
  private convertMassToVolume(mass: number, fromUnit: string, toUnit: string, ingredient?: Ingredient): number {
    if (!ingredient) {
      throw new BadRequestException('Ingredient required for mass-to-volume conversion');
    }

    if (!ingredient.allowMassVolumeConversion) {
      throw new BadRequestException(`Ingredient ${ingredient.name} does not allow mass-volume conversions`);
    }

    // Convert mass to grams
    const massInGrams = this.convertWithinCategory(mass, fromUnit, 'g');
    
    // Convert grams to ml using density (density = g/ml)
    const volumeInMl = massInGrams / ingredient.density;
    
    // Convert ml to target volume unit
    return this.convertWithinCategory(volumeInMl, 'ml', toUnit);
  }

  /**
   * Converts volume to mass using ingredient density
   */
  private convertVolumeToMass(volume: number, fromUnit: string, toUnit: string, ingredient?: Ingredient): number {
    if (!ingredient) {
      throw new BadRequestException('Ingredient required for volume-to-mass conversion');
    }

    if (!ingredient.allowMassVolumeConversion) {
      throw new BadRequestException(`Ingredient ${ingredient.name} does not allow mass-volume conversions`);
    }

    // Convert volume to ml
    const volumeInMl = this.convertWithinCategory(volume, fromUnit, 'ml');
    
    // Convert ml to grams using density (density = g/ml)
    const massInGrams = volumeInMl * ingredient.density;
    
    // Convert grams to target mass unit
    return this.convertWithinCategory(massInGrams, 'g', toUnit);
  }

  /**
   * Converts within the same category (mass-mass or volume-volume)
   */
  private convertWithinCategory(quantity: number, fromUnit: string, toUnit: string): number {
    const valueInBase = quantity * this.conversionFactors[fromUnit];
    return valueInBase / this.conversionFactors[toUnit];
  }

  /**
   * Checks if a unit is a mass unit
   */
  private isMassUnit(unit: string): boolean {
    return ['g', 'kg'].includes(unit);
  }

  /**
   * Checks if a unit is a volume unit
   */
  private isVolumeUnit(unit: string): boolean {
    return ['ml', 'oz', 'l', 'cl'].includes(unit);
  }

  /**
   * Checks if a unit is a count unit
   */
  private isCountUnit(unit: string): boolean {
    return unit === 'units';
  }
}
