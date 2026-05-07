import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';

export interface ParsedMeasure {
  amount: number;
  unit: string;
}

@Injectable()
export class MeasureParserService {
  parse(measure: string): ParsedMeasure {
    if (!measure) {
      return { amount: 1, unit: 'parts' };
    }

    const measureStr = measure.trim().toLowerCase();

    // Handle mixed fractions: "1 1/2 oz"
    const mixedFractionMatch = measureStr.match(
      /^(\d+)\s+(\d+)\/(\d+)\s*(.+)$/,
    );
    if (mixedFractionMatch) {
      const whole = new Decimal(mixedFractionMatch[1]);
      const num = new Decimal(mixedFractionMatch[2]);
      const den = new Decimal(mixedFractionMatch[3]);
      const unit = mixedFractionMatch[4].trim();
      return { amount: whole.plus(num.div(den)).toNumber(), unit };
    }

    // Handle simple fractions: "3/4 oz"
    const fractionMatch = measureStr.match(/^(\d+)\/(\d+)\s*(.+)$/);
    if (fractionMatch) {
      const num = new Decimal(fractionMatch[1]);
      const den = new Decimal(fractionMatch[2]);
      const unit = fractionMatch[3].trim();
      return { amount: num.div(den).toNumber(), unit };
    }

    // Common patterns for decimal amounts
    const patterns = [
      { regex: /(\d+(?:\.\d+)?)\s*ml/, unit: 'ml' },
      { regex: /(\d+(?:\.\d+)?)\s*oz/, unit: 'oz' },
      { regex: /(\d+(?:\.\d+)?)\s*cl/, unit: 'cl' },
      { regex: /(\d+(?:\.\d+)?)\s*dash(?:es)?/, unit: 'dashes' },
      { regex: /(\d+(?:\.\d+)?)\s*drop(?:s)?/, unit: 'drops' },
      { regex: /(\d+(?:\.\d+)?)\s*splash(?:es)?/, unit: 'splashes' },
      { regex: /(\d+(?:\.\d+)?)\s*part(?:s)?/, unit: 'parts' },
      { regex: /(\d+(?:\.\d+)?)\s*slice(?:s)?/, unit: 'slices' },
      { regex: /(\d+(?:\.\d+)?)\s*wedge(?:s)?/, unit: 'wedges' },
      { regex: /(\d+(?:\.\d+)?)\s*twist(?:s)?/, unit: 'twists' },
      { regex: /(\d+(?:\.\d+)?)\s*sprig(?:s)?/, unit: 'sprigs' },
      { regex: /(\d+(?:\.\d+)?)\s*(?:leaf|leaves)/, unit: 'leaves' },
    ];

    for (const pattern of patterns) {
      const match = measureStr.match(pattern.regex);
      if (match) {
        return { amount: new Decimal(match[1]).toNumber(), unit: pattern.unit };
      }
    }

    // Default to parts if it's just a number
    const numberMatch = measureStr.match(/(\d+(?:\.\d+)?)/);
    if (numberMatch) {
      return { amount: new Decimal(numberMatch[1]).toNumber(), unit: 'parts' };
    }

    // Default values for descriptive measures
    if (measureStr.includes('pinch') || measureStr.includes('dash')) {
      return { amount: 1, unit: 'dashes' };
    }
    if (measureStr.includes('splash')) {
      return { amount: 1, unit: 'splashes' };
    }
    if (measureStr.includes('to taste') || measureStr.includes('garnish')) {
      return { amount: 1, unit: 'count' };
    }

    return { amount: 1, unit: 'parts' };
  }
}
