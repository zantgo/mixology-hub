"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCocktailWithFileDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
class CreateCocktailIngredientDto {
    ingredientId;
    amount;
    unit;
    measure;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'uuid-of-ingredient', description: 'Ingredient ID from catalog' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCocktailIngredientDto.prototype, "ingredientId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Numeric amount for inventory logic/calculation' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateCocktailIngredientDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'oz', description: 'Unit used for calculation (ml, oz, grams)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCocktailIngredientDto.prototype, "unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2 oz', description: 'Full string for display purposes (UI label)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCocktailIngredientDto.prototype, "measure", void 0);
class CreateCocktailWithFileDto {
    name;
    description;
    instructions;
    ingredients;
    isPublic;
}
exports.CreateCocktailWithFileDto = CreateCocktailWithFileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Mojito', description: 'Name of the cocktail' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCocktailWithFileDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'A refreshing mint drink', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCocktailWithFileDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Mix all ingredients with ice.', description: 'Step by step instructions' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCocktailWithFileDto.prototype, "instructions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [CreateCocktailIngredientDto], description: 'List of ingredients with measurements' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateCocktailIngredientDto),
    __metadata("design:type", Array)
], CreateCocktailWithFileDto.prototype, "ingredients", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'Whether the cocktail is publicly visible to other users',
        required: false,
        default: true
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCocktailWithFileDto.prototype, "isPublic", void 0);
//# sourceMappingURL=create-cocktail-with-file.dto.js.map