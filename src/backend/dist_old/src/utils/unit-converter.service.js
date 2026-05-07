"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitConverterService = void 0;
const common_1 = require("@nestjs/common");
const decimal_js_1 = require("decimal.js");
let UnitConverterService = class UnitConverterService {
    conversionFactors = {
        'ml': new decimal_js_1.Decimal(1),
        'oz': new decimal_js_1.Decimal(29.57),
        'l': new decimal_js_1.Decimal(1000),
        'cl': new decimal_js_1.Decimal(10),
        'count': new decimal_js_1.Decimal(1),
        'g': new decimal_js_1.Decimal(1),
        'kg': new decimal_js_1.Decimal(1000),
    };
    convert(quantity, fromUnit, toUnit, ingredient) {
        const qty = quantity instanceof decimal_js_1.Decimal ? quantity : new decimal_js_1.Decimal(quantity);
        const from = fromUnit.toLowerCase();
        const to = toUnit.toLowerCase();
        if (!this.conversionFactors[from] || !this.conversionFactors[to]) {
            throw new common_1.BadRequestException(`Conversion from ${from} to ${to} is not supported.`);
        }
        if (this.isMassUnit(from) && this.isVolumeUnit(to)) {
            return this.convertMassToVolume(qty, from, to, ingredient);
        }
        else if (this.isVolumeUnit(from) && this.isMassUnit(to)) {
            return this.convertVolumeToMass(qty, from, to, ingredient);
        }
        const valueInBase = qty.times(this.conversionFactors[from]);
        return valueInBase.div(this.conversionFactors[to]);
    }
    hasEnoughStock(stockQuantity, stockUnit, requiredAmount, requiredUnit, ingredient) {
        try {
            const stockInRequiredUnit = this.convert(stockQuantity, stockUnit, requiredUnit, ingredient);
            const req = requiredAmount instanceof decimal_js_1.Decimal ? requiredAmount : new decimal_js_1.Decimal(requiredAmount);
            return stockInRequiredUnit.gte(req);
        }
        catch (e) {
            return false;
        }
    }
    convertMassToVolume(mass, fromUnit, toUnit, ingredient) {
        if (!ingredient) {
            throw new common_1.BadRequestException('Ingredient required for mass-to-volume conversion');
        }
        if (!ingredient.allowMassVolumeConversion) {
            throw new common_1.BadRequestException(`Ingredient ${ingredient.name} does not allow mass-volume conversions`);
        }
        const massInGrams = this.convertWithinCategory(mass, fromUnit, 'g');
        const volumeInMl = massInGrams.div(ingredient.density);
        return this.convertWithinCategory(volumeInMl, 'ml', toUnit);
    }
    convertVolumeToMass(volume, fromUnit, toUnit, ingredient) {
        if (!ingredient) {
            throw new common_1.BadRequestException('Ingredient required for volume-to-mass conversion');
        }
        if (!ingredient.allowMassVolumeConversion) {
            throw new common_1.BadRequestException(`Ingredient ${ingredient.name} does not allow mass-volume conversions`);
        }
        const volumeInMl = this.convertWithinCategory(volume, fromUnit, 'ml');
        const massInGrams = volumeInMl.times(ingredient.density);
        return this.convertWithinCategory(massInGrams, 'g', toUnit);
    }
    convertWithinCategory(quantity, fromUnit, toUnit) {
        const valueInBase = quantity.times(this.conversionFactors[fromUnit]);
        return valueInBase.div(this.conversionFactors[toUnit]);
    }
    isMassUnit(unit) {
        return ['g', 'kg'].includes(unit);
    }
    isVolumeUnit(unit) {
        return ['ml', 'oz', 'l', 'cl'].includes(unit);
    }
};
exports.UnitConverterService = UnitConverterService;
exports.UnitConverterService = UnitConverterService = __decorate([
    (0, common_1.Injectable)()
], UnitConverterService);
//# sourceMappingURL=unit-converter.service.js.map