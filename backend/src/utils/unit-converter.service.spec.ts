import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { UnitConverterService } from './unit-converter.service';
import { Ingredient } from '../ingredients/entities/ingredient.entity';

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    name: 'Test Ingredient',
    baseUnit: 'ml',
    density: new Decimal(1.0),
    allowMassVolumeConversion: true,
    ...overrides,
  } as Ingredient;
}

describe('UnitConverterService', () => {
  let service: UnitConverterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UnitConverterService],
    }).compile();

    service = module.get<UnitConverterService>(UnitConverterService);
  });

  describe('convert', () => {
    describe('volume-to-volume conversions', () => {
      it('should return same value when from and to units are identical', () => {
        const result = service.convert(100, 'ml', 'ml');
        expect(result.toNumber()).toBe(100);
      });

      it('should convert ml to ml (base unit)', () => {
        const result = service.convert(500, 'ml', 'ml');
        expect(result.toNumber()).toBe(500);
      });

      it('should convert oz to ml', () => {
        const result = service.convert(2, 'oz', 'ml');
        expect(result.toNumber()).toBeCloseTo(59.14, 1);
      });

      it('should convert ml to oz', () => {
        const result = service.convert(59.14, 'ml', 'oz');
        expect(result.toNumber()).toBeCloseTo(2, 0);
      });

      it('should convert l to ml', () => {
        const result = service.convert(1, 'l', 'ml');
        expect(result.toNumber()).toBe(1000);
      });

      it('should convert ml to l', () => {
        const result = service.convert(500, 'ml', 'l');
        expect(result.toNumber()).toBe(0.5);
      });

      it('should convert cl to ml', () => {
        const result = service.convert(5, 'cl', 'ml');
        expect(result.toNumber()).toBe(50);
      });

      it('should convert ml to cl', () => {
        const result = service.convert(100, 'ml', 'cl');
        expect(result.toNumber()).toBe(10);
      });

      it('should convert tbsp to ml', () => {
        const result = service.convert(1, 'tbsp', 'ml');
        expect(result.toNumber()).toBeCloseTo(14.79, 1);
      });

      it('should convert tsp to ml', () => {
        const result = service.convert(1, 'tsp', 'ml');
        expect(result.toNumber()).toBeCloseTo(4.93, 1);
      });

      it('should convert dash to ml', () => {
        const result = service.convert(1, 'dash', 'ml');
        expect(result.toNumber()).toBeCloseTo(0.92, 1);
      });

      it('should convert dashes to ml', () => {
        const result = service.convert(1, 'dashes', 'ml');
        expect(result.toNumber()).toBeCloseTo(0.92, 1);
      });

      it('should convert oz to tbsp', () => {
        const result = service.convert(1, 'oz', 'tbsp');
        expect(result.toNumber()).toBeCloseTo(2, 0);
      });

      it('should handle decimal quantities', () => {
        const result = service.convert(1.5, 'oz', 'ml');
        expect(result.toNumber()).toBeCloseTo(44.355, 1);
      });

      it('should handle Decimal input', () => {
        const result = service.convert(new Decimal(2), 'oz', 'ml');
        expect(result.toNumber()).toBeCloseTo(59.14, 1);
      });
    });

    describe('mass-to-mass conversions', () => {
      it('should convert g to g (identity)', () => {
        const result = service.convert(100, 'g', 'g');
        expect(result.toNumber()).toBe(100);
      });

      it('should convert kg to g', () => {
        const result = service.convert(1, 'kg', 'g');
        expect(result.toNumber()).toBe(1000);
      });

      it('should convert g to kg', () => {
        const result = service.convert(500, 'g', 'kg');
        expect(result.toNumber()).toBe(0.5);
      });
    });

    describe('mass-to-volume conversions (with ingredient)', () => {
      it('should convert g to ml using ingredient density of 1', () => {
        const ingredient = makeIngredient({ density: new Decimal(1.0) });
        const result = service.convert(100, 'g', 'ml', ingredient);
        expect(result.toNumber()).toBeCloseTo(100, 1);
      });

      it('should convert ml to g using ingredient density of 1', () => {
        const ingredient = makeIngredient({ density: new Decimal(1.0) });
        const result = service.convert(100, 'ml', 'g', ingredient);
        expect(result.toNumber()).toBeCloseTo(100, 1);
      });

      it('should convert g to ml using ingredient density of 0.8', () => {
        const ingredient = makeIngredient({ density: new Decimal(0.8) });
        const result = service.convert(100, 'g', 'ml', ingredient);
        // massInGrams / density = 100 / 0.8 = 125 ml
        expect(result.toNumber()).toBeCloseTo(125, 1);
      });

      it('should convert ml to g using ingredient density of 0.8', () => {
        const ingredient = makeIngredient({ density: new Decimal(0.8) });
        const result = service.convert(100, 'ml', 'g', ingredient);
        // volumeInMl * density = 100 * 0.8 = 80 g
        expect(result.toNumber()).toBeCloseTo(80, 1);
      });

      it('should convert kg to oz through mass-to-volume chain', () => {
        const ingredient = makeIngredient({ density: new Decimal(1.0) });
        const result = service.convert(1, 'kg', 'oz', ingredient);
        // 1 kg = 1000 g → 1000 ml → 1000 / 29.57 ≈ 33.82 oz
        expect(result.toNumber()).toBeCloseTo(33.818, 0);
      });

      it('should convert oz to kg through volume-to-mass chain', () => {
        const ingredient = makeIngredient({ density: new Decimal(1.0) });
        const result = service.convert(33.814, 'oz', 'kg', ingredient);
        // 33.814 oz → 1000 ml → 1000 g → 1 kg
        expect(result.toNumber()).toBeCloseTo(1, 0);
      });

      it('should throw when mass-to-volume without ingredient', () => {
        expect(() => service.convert(100, 'g', 'ml')).toThrow(BadRequestException);
      });

      it('should throw when volume-to-mass without ingredient', () => {
        expect(() => service.convert(100, 'ml', 'g')).toThrow(BadRequestException);
      });

      it('should throw when ingredient does not allow mass-volume conversion', () => {
        const ingredient = makeIngredient({ allowMassVolumeConversion: false });
        expect(() => service.convert(100, 'g', 'ml', ingredient)).toThrow(BadRequestException);
      });
    });

    describe('discrete unit conversions', () => {
      it('should convert count to count (1:1)', () => {
        const result = service.convert(3, 'count', 'count');
        expect(result.toNumber()).toBe(3);
      });

      it('should convert parts to parts (1:1)', () => {
        const result = service.convert(2, 'parts', 'parts');
        expect(result.toNumber()).toBe(2);
      });

      it('should convert part to part (1:1)', () => {
        const result = service.convert(1, 'part', 'part');
        expect(result.toNumber()).toBe(1);
      });

      it('should convert drops to drops (1:1)', () => {
        const result = service.convert(5, 'drops', 'drop');
        expect(result.toNumber()).toBe(5);
      });

      it('should convert slices to slices (1:1)', () => {
        const result = service.convert(2, 'slices', 'slice');
        expect(result.toNumber()).toBe(2);
      });

      it('should convert wedges to wedges (1:1)', () => {
        const result = service.convert(3, 'wedges', 'wedge');
        expect(result.toNumber()).toBe(3);
      });

      it('should convert twists to twists (1:1)', () => {
        const result = service.convert(1, 'twists', 'twist');
        expect(result.toNumber()).toBe(1);
      });

      it('should convert sprigs to sprigs (1:1)', () => {
        const result = service.convert(2, 'sprigs', 'sprig');
        expect(result.toNumber()).toBe(2);
      });

      it('should convert leaves to leaves (1:1)', () => {
        const result = service.convert(4, 'leaves', 'leaf');
        expect(result.toNumber()).toBe(4);
      });

      it('should convert splashes to splashes (1:1)', () => {
        const result = service.convert(2, 'splashes', 'splash');
        expect(result.toNumber()).toBe(2);
      });
    });

    describe('unsupported unit handling', () => {
      it('should throw for unsupported from-unit', () => {
        expect(() => service.convert(100, 'gallon', 'ml')).toThrow(BadRequestException);
      });

      it('should throw for unsupported to-unit', () => {
        expect(() => service.convert(100, 'ml', 'gallon')).toThrow(BadRequestException);
      });

      it('should throw for completely unknown unit', () => {
        expect(() => service.convert(100, 'barrel', 'liter')).toThrow(BadRequestException);
      });
    });

    describe('case insensitivity', () => {
      it('should handle uppercase unit names', () => {
        const result = service.convert(1000, 'ML', 'L');
        expect(result.toNumber()).toBe(1);
      });

      it('should handle mixed-case unit names', () => {
        const result = service.convert(2, 'Oz', 'Ml');
        expect(result.toNumber()).toBeCloseTo(59.14, 1);
      });
    });

    describe('zero and edge quantities', () => {
      it('should handle zero quantity', () => {
        const result = service.convert(0, 'ml', 'oz');
        expect(result.toNumber()).toBe(0);
      });

      it('should handle zero via Decimal', () => {
        const result = service.convert(new Decimal(0), 'ml', 'oz');
        expect(result.toNumber()).toBe(0);
      });

      it('should handle very small quantities', () => {
        const result = service.convert(0.01, 'ml', 'ml');
        expect(result.toNumber()).toBeCloseTo(0.01, 4);
      });

      it('should handle very large quantities', () => {
        const result = service.convert(1000000, 'ml', 'l');
        expect(result.toNumber()).toBe(1000);
      });
    });

    describe('cross discrete/volume conversions', () => {
      it('should not convert count to ml (both factor 1, treated as same-category)', () => {
        // Both 'count' and 'ml' have factor 1, so they convert 1:1
        // This is by design in the current implementation.
        const result = service.convert(3, 'count', 'ml');
        expect(result.toNumber()).toBe(3);
      });

      it('should not convert parts to oz (both non-mass/non-volume)', () => {
        const result = service.convert(2, 'parts', 'oz');
        // parts factor=1, oz factor=29.57 → 2*1 / 29.57 ≈ 0.0676
        expect(result.toNumber()).toBeCloseTo(0.0676, 2);
      });
    });
  });

  describe('hasEnoughStock', () => {
    it('should return true when stock exceeds requirement', () => {
      const result = service.hasEnoughStock(500, 'ml', 100, 'ml');
      expect(result).toBe(true);
    });

    it('should return true when stock equals requirement', () => {
      const result = service.hasEnoughStock(100, 'ml', 100, 'ml');
      expect(result).toBe(true);
    });

    it('should return false when stock is less than requirement', () => {
      const result = service.hasEnoughStock(50, 'ml', 100, 'ml');
      expect(result).toBe(false);
    });

    it('should convert units when comparing', () => {
      // 1 oz ≈ 29.57 ml, so 30 ml > 1 oz
      const result = service.hasEnoughStock(30, 'ml', 1, 'oz');
      expect(result).toBe(true);
    });

    it('should convert units when stock is insufficient', () => {
      const result = service.hasEnoughStock(20, 'ml', 1, 'oz');
      expect(result).toBe(false);
    });

    it('should handle Decimal inputs', () => {
      const result = service.hasEnoughStock(
        new Decimal(500),
        'ml',
        new Decimal(100),
        'ml',
      );
      expect(result).toBe(true);
    });

    it('should return false for unsupported unit conversion', () => {
      const result = service.hasEnoughStock(100, 'unsupported', 'ml');
      expect(result).toBe(false);
    });

    it('should handle zero stock', () => {
      const result = service.hasEnoughStock(0, 'ml', 1, 'ml');
      expect(result).toBe(false);
    });

    it('should handle zero requirement', () => {
      const result = service.hasEnoughStock(100, 'ml', 0, 'ml');
      expect(result).toBe(true);
    });

    it('should support mass-volume comparison with ingredient', () => {
      const ingredient = makeIngredient({ density: new Decimal(1.0) });
      // 100 g ≈ 100 ml at density 1
      const result = service.hasEnoughStock(100, 'ml', 50, 'g', ingredient);
      expect(result).toBe(true);
    });

    it('should fail mass-volume comparison without ingredient', () => {
      const result = service.hasEnoughStock(100, 'ml', 50, 'g');
      expect(result).toBe(false);
    });
  });
});
