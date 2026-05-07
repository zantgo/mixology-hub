import { Test, TestingModule } from '@nestjs/testing';
import { MeasureParserService } from './measure-parser.service';

describe('MeasureParserService', () => {
  let service: MeasureParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MeasureParserService],
    }).compile();

    service = module.get<MeasureParserService>(MeasureParserService);
  });

  describe('fractions', () => {
    it('should parse mixed fractions: "1 1/2 oz"', () => {
      const result = service.parse('1 1/2 oz');
      expect(result.amount).toBeCloseTo(1.5, 4);
      expect(result.unit).toBe('oz');
    });

    it('should parse simple fractions: "3/4 oz"', () => {
      const result = service.parse('3/4 oz');
      expect(result.amount).toBeCloseTo(0.75, 4);
      expect(result.unit).toBe('oz');
    });

    it('should parse "1/3 oz" with 4-decimal precision', () => {
      const result = service.parse('1/3 oz');
      expect(result.amount).toBeCloseTo(0.3333, 4);
      expect(result.unit).toBe('oz');
    });

    it('should parse "2/3 cup" as parts (cup not recognized)', () => {
      const result = service.parse('2/3 cup');
      expect(result.amount).toBeCloseTo(0.6667, 4);
      expect(result.unit).toBe('cup');
    });
  });

  describe('decimal amounts', () => {
    it('should parse "50 ml"', () => {
      const result = service.parse('50 ml');
      expect(result.amount).toBe(50);
      expect(result.unit).toBe('ml');
    });

    it('should parse "2 oz"', () => {
      const result = service.parse('2 oz');
      expect(result.amount).toBe(2);
      expect(result.unit).toBe('oz');
    });

    it('should parse "0.5 oz"', () => {
      const result = service.parse('0.5 oz');
      expect(result.amount).toBeCloseTo(0.5, 4);
      expect(result.unit).toBe('oz');
    });

    it('should parse "2.5 cl"', () => {
      const result = service.parse('2.5 cl');
      expect(result.amount).toBeCloseTo(2.5, 4);
      expect(result.unit).toBe('cl');
    });
  });

  describe('descriptive measures', () => {
    it('should parse "3 dashes"', () => {
      const result = service.parse('3 dashes');
      expect(result.amount).toBe(3);
      expect(result.unit).toBe('dashes');
    });

    it('should parse "1 dash"', () => {
      const result = service.parse('1 dash');
      expect(result.amount).toBe(1);
      expect(result.unit).toBe('dashes');
    });

    it('should parse "2 splashes"', () => {
      const result = service.parse('2 splashes');
      expect(result.amount).toBe(2);
      expect(result.unit).toBe('splashes');
    });

    it('should parse "a pinch" as dashes', () => {
      const result = service.parse('a pinch');
      expect(result.amount).toBe(1);
      expect(result.unit).toBe('dashes');
    });

    it('should parse "to taste" as count', () => {
      const result = service.parse('to taste');
      expect(result.amount).toBe(1);
      expect(result.unit).toBe('count');
    });

    it('should parse "garnish" as count', () => {
      const result = service.parse('garnish');
      expect(result.amount).toBe(1);
      expect(result.unit).toBe('count');
    });
  });

  describe('discrete items', () => {
    it('should parse "2 slices"', () => {
      const result = service.parse('2 slices');
      expect(result.amount).toBe(2);
      expect(result.unit).toBe('slices');
    });

    it('should parse "1 wedge"', () => {
      const result = service.parse('1 wedge');
      expect(result.amount).toBe(1);
      expect(result.unit).toBe('wedges');
    });

    it('should parse "1 twist"', () => {
      const result = service.parse('1 twist');
      expect(result.amount).toBe(1);
      expect(result.unit).toBe('twists');
    });

    it('should parse "2 sprigs"', () => {
      const result = service.parse('2 sprigs');
      expect(result.amount).toBe(2);
      expect(result.unit).toBe('sprigs');
    });

    it('should parse "4 leaves"', () => {
      const result = service.parse('4 leaves');
      expect(result.amount).toBe(4);
      expect(result.unit).toBe('leaves');
    });
  });

  describe('fallbacks', () => {
    it('should return parts for unknown unit with number', () => {
      const result = service.parse('10 something');
      expect(result.amount).toBe(10);
      expect(result.unit).toBe('parts');
    });

    it('should return parts for empty string', () => {
      const result = service.parse('');
      expect(result.amount).toBe(1);
      expect(result.unit).toBe('parts');
    });

    it('should return parts for just a number', () => {
      const result = service.parse('3');
      expect(result.amount).toBe(3);
      expect(result.unit).toBe('parts');
    });
  });

  describe('insensitive case and spacing', () => {
    it('should handle uppercase: "50 ML"', () => {
      const result = service.parse('50 ML');
      expect(result.amount).toBe(50);
      expect(result.unit).toBe('ml');
    });

    it('should handle mixed case: "2 Oz"', () => {
      const result = service.parse('2 Oz');
      expect(result.amount).toBe(2);
      expect(result.unit).toBe('oz');
    });

    it('should handle extra spaces: "  50   ml  "', () => {
      const result = service.parse('  50   ml  ');
      expect(result.amount).toBe(50);
      expect(result.unit).toBe('ml');
    });
  });
});
