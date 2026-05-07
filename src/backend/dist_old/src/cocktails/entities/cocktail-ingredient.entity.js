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
exports.CocktailIngredient = void 0;
const typeorm_1 = require("typeorm");
const decimal_js_1 = require("decimal.js");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const cocktail_entity_1 = require("./cocktail.entity");
const ingredient_entity_1 = require("../../ingredients/entities/ingredient.entity");
const column_numeric_transformer_1 = require("../../utils/column-numeric.transformer");
let CocktailIngredient = class CocktailIngredient {
    id;
    cocktail;
    ingredient;
    measure;
    amount;
    unit;
};
exports.CocktailIngredient = CocktailIngredient;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unique identifier of the recipe-ingredient relationship' }),
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    (0, class_transformer_1.Expose)(),
    __metadata("design:type", String)
], CocktailIngredient.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => cocktail_entity_1.Cocktail, (cocktail) => cocktail.ingredients, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'cocktail_id' }),
    __metadata("design:type", cocktail_entity_1.Cocktail)
], CocktailIngredient.prototype, "cocktail", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => ingredient_entity_1.Ingredient, description: 'The linked ingredient from the catalog' }),
    (0, typeorm_1.ManyToOne)(() => ingredient_entity_1.Ingredient, { eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'ingredient_id' }),
    (0, class_transformer_1.Expose)(),
    __metadata("design:type", ingredient_entity_1.Ingredient)
], CocktailIngredient.prototype, "ingredient", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2 oz', description: 'Human-readable measurement string' }),
    (0, typeorm_1.Column)(),
    (0, class_transformer_1.Expose)(),
    __metadata("design:type", String)
], CocktailIngredient.prototype, "measure", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2.00, description: 'Numeric amount for inventory calculation' }),
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 4, default: 0, transformer: new column_numeric_transformer_1.ColumnNumericTransformer(), nullable: true }),
    (0, class_transformer_1.Expose)(),
    __metadata("design:type", decimal_js_1.Decimal)
], CocktailIngredient.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'oz', description: 'The unit used for calculations (ml, oz, grams)' }),
    (0, typeorm_1.Column)({ default: 'count' }),
    (0, class_transformer_1.Expose)(),
    __metadata("design:type", String)
], CocktailIngredient.prototype, "unit", void 0);
exports.CocktailIngredient = CocktailIngredient = __decorate([
    (0, typeorm_1.Entity)('cocktail_ingredients')
], CocktailIngredient);
//# sourceMappingURL=cocktail-ingredient.entity.js.map