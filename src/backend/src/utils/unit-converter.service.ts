import { Injectable, BadRequestException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { Ingredient } from '../ingredients/entities/ingredient.entity';

@Injectable()
export class UnitConverterService {
  private readonly conversionFactors: Record<string, Decimal> = {
    ml: new Decimal(1),
    oz: new Decimal(29.57),
    l: new Decimal(1000),
    cl: new Decimal(10),
    tbsp: new Decimal(14.79),
    tsp: new Decimal(4.93),
    dash: new Decimal(0.92),
    dashes: new Decimal(0.92),
    count: new Decimal(1),
    g: new Decimal(1),
    kg: new Decimal(1000),
    parts: new Decimal(1),
    part: new Decimal(1),
    drops: new Decimal(1),
    drop: new Decimal(1),
    splashes: new Decimal(1),
    splash: new Decimal(1),
    slices: new Decimal(1),
    slice: new Decimal(1),
    wedges: new Decimal(1),
    wedge: new Decimal(1),
    twists: new Decimal(1),
    twist: new Decimal(1),
    sprigs: new Decimal(1),
    sprig: new Decimal(1),
    leaves: new Decimal(1),
    leaf: new Decimal(1),
    piece: new Decimal(1),
    whole: new Decimal(1),
    item: new Decimal(1),
    unit: new Decimal(1),
  };

  private readonly unitCategories: Record<string, 'volume' | 'mass' | 'count'> =
    {
      ml: 'volume',
      oz: 'volume',
      l: 'volume',
      cl: 'volume',
      tbsp: 'volume',
      tsp: 'volume',
      dash: 'volume',
      dashes: 'volume',
      g: 'mass',
      kg: 'mass',
      count: 'count',
      piece: 'count',
      whole: 'count',
      item: 'count',
      unit: 'count',
      parts: 'count',
      part: 'count',
      drops: 'count',
      drop: 'count',
      splashes: 'count',
      splash: 'count',
      slices: 'count',
      slice: 'count',
      wedges: 'count',
      wedge: 'count',
      twists: 'count',
      twist: 'count',
      sprigs: 'count',
      sprig: 'count',
      leaves: 'count',
      leaf: 'count',
    };

  areUnitsCompatible(fromUnit: string, toUnit: string): boolean {
    const fromCat = this.unitCategories[fromUnit.toLowerCase()];
    const toCat = this.unitCategories[toUnit.toLowerCase()];
    if (!fromCat || !toCat) return false;
    return fromCat === toCat;
  }

  canConvertBetween(
    fromUnit: string,
    toUnit: string,
    ingredient?: Ingredient,
  ): boolean {
    if (this.areUnitsCompatible(fromUnit, toUnit)) return true;
    const fromCat = this.unitCategories[fromUnit.toLowerCase()];
    const toCat = this.unitCategories[toUnit.toLowerCase()];
    if (
      ((fromCat === 'mass' && toCat === 'volume') ||
        (fromCat === 'volume' && toCat === 'mass')) &&
      ingredient?.allowMassVolumeConversion
    ) {
      return true;
    }
    return false;
  }

  convert(
    quantity: Decimal | number,
    fromUnit: string,
    toUnit: string,
    ingredient?: Ingredient,
  ): Decimal {
    const qty = quantity instanceof Decimal ? quantity : new Decimal(quantity);
    const from = fromUnit.toLowerCase();
    const to = toUnit.toLowerCase();

    if (!this.conversionFactors[from] || !this.conversionFactors[to]) {
      throw new BadRequestException(
        `Conversion from ${from} to ${to} is not supported.`,
      );
    }

    if (!this.canConvertBetween(from, to, ingredient)) {
      throw new BadRequestException(
        `Incompatible unit type: Conversion between ${from} and ${to} is logically impossible.`,
      );
    }

    if (this.isMassUnit(from) && this.isVolumeUnit(to)) {
      return this.convertMassToVolume(qty, from, to, ingredient);
    } else if (this.isVolumeUnit(from) && this.isMassUnit(to)) {
      return this.convertVolumeToMass(qty, from, to, ingredient);
    }

    const valueInBase = qty.times(this.conversionFactors[from]);
    return valueInBase.div(this.conversionFactors[to]);
  }

  hasEnoughStock(
    stockQuantity: Decimal | number,
    stockUnit: string,
    requiredAmount: Decimal | number,
    requiredUnit: string,
    ingredient?: Ingredient,
  ): boolean {
    try {
      const stockInRequiredUnit = this.convert(
        stockQuantity,
        stockUnit,
        requiredUnit,
        ingredient,
      );
      const req =
        requiredAmount instanceof Decimal
          ? requiredAmount
          : new Decimal(requiredAmount);
      return stockInRequiredUnit.gte(req);
    } catch {
      return false;
    }
  }

  private convertMassToVolume(
    mass: Decimal,
    fromUnit: string,
    toUnit: string,
    ingredient?: Ingredient,
  ): Decimal {
    if (!ingredient) {
      throw new BadRequestException(
        'Ingredient required for mass-to-volume conversion',
      );
    }

    if (!ingredient.allowMassVolumeConversion) {
      throw new BadRequestException(
        `Ingredient ${ingredient.name} does not allow mass-volume conversions`,
      );
    }

    if (!ingredient.density || ingredient.density.lte(0)) {
      throw new BadRequestException(
        `Ingredient ${ingredient.name} has invalid density (must be > 0)`,
      );
    }

    const massInGrams = this.convertWithinCategory(mass, fromUnit, 'g');
    const volumeInMl = massInGrams.div(ingredient.density);
    return this.convertWithinCategory(volumeInMl, 'ml', toUnit);
  }

  private convertVolumeToMass(
    volume: Decimal,
    fromUnit: string,
    toUnit: string,
    ingredient?: Ingredient,
  ): Decimal {
    if (!ingredient) {
      throw new BadRequestException(
        'Ingredient required for volume-to-mass conversion',
      );
    }

    if (!ingredient.allowMassVolumeConversion) {
      throw new BadRequestException(
        `Ingredient ${ingredient.name} does not allow mass-volume conversions`,
      );
    }

    if (!ingredient.density || ingredient.density.lte(0)) {
      throw new BadRequestException(
        `Ingredient ${ingredient.name} has invalid density (must be > 0)`,
      );
    }

    const volumeInMl = this.convertWithinCategory(volume, fromUnit, 'ml');
    const massInGrams = volumeInMl.times(ingredient.density);
    return this.convertWithinCategory(massInGrams, 'g', toUnit);
  }

  private convertWithinCategory(
    quantity: Decimal,
    fromUnit: string,
    toUnit: string,
  ): Decimal {
    const valueInBase = quantity.times(this.conversionFactors[fromUnit]);
    return valueInBase.div(this.conversionFactors[toUnit]);
  }

  private isMassUnit(unit: string): boolean {
    return ['g', 'kg'].includes(unit);
  }

  private isVolumeUnit(unit: string): boolean {
    return ['ml', 'oz', 'l', 'cl', 'tbsp', 'tsp', 'dash', 'dashes'].includes(
      unit,
    );
  }
}
