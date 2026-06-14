import { Pipe, PipeTransform } from '@angular/core';

const FACTORS: Record<string, number> = {
  ml: 1,
  oz: 29.57,
  cl: 10,
  l: 1000,
  tbsp: 14.79,
  tsp: 4.93,
  g: 1,
  kg: 1000,
};

@Pipe({ standalone: true, name: 'unitConvert' })
export class UnitConversionPipe implements PipeTransform {
  transform(value: number, fromUnit: string, toUnit: string = 'ml'): string {
    const from = FACTORS[fromUnit?.toLowerCase()] || 1;
    const to = FACTORS[toUnit?.toLowerCase()] || 1;
    const result = (value * from) / to;
    return result % 1 === 0 ? result.toString() : result.toFixed(2);
  }
}
