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
exports.Ingredient = void 0;
const typeorm_1 = require("typeorm");
const decimal_js_1 = require("decimal.js");
const swagger_1 = require("@nestjs/swagger");
const column_numeric_transformer_1 = require("../../utils/column-numeric.transformer");
let Ingredient = class Ingredient {
    id;
    name;
    baseUnit;
    parent;
    parentId;
    children;
    isGlobal;
    normalizedName;
    synonyms;
    createdBy;
    hierarchyLevel;
    density;
    allowMassVolumeConversion;
    normalizeName() {
        if (this.name) {
            this.normalizedName = this.name.toUpperCase().trim();
        }
    }
};
exports.Ingredient = Ingredient;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unique identifier of the ingredient' }),
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Ingredient.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'vodka', description: 'The name of the ingredient (must be unique per user for custom ingredients)' }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Ingredient.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ml', description: 'The base unit for this ingredient (ml, g, count)' }),
    (0, typeorm_1.Column)({ default: 'ml' }),
    __metadata("design:type", String)
], Ingredient.prototype, "baseUnit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Parent ingredient for hierarchical relationships' }),
    (0, typeorm_1.ManyToOne)(() => Ingredient, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'parent_id' }),
    __metadata("design:type", Object)
], Ingredient.prototype, "parent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'parent_id', nullable: true }),
    __metadata("design:type", Object)
], Ingredient.prototype, "parentId", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Ingredient, (ingredient) => ingredient.parent),
    __metadata("design:type", Array)
], Ingredient.prototype, "children", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Whether this is a global/system ingredient (true) or user-created custom ingredient (false)' }),
    (0, typeorm_1.Column)({ name: 'is_global', default: true }),
    __metadata("design:type", Boolean)
], Ingredient.prototype, "isGlobal", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'VODKA', description: 'Normalized uppercase name for case-insensitive matching' }),
    (0, typeorm_1.Column)({ name: 'normalized_name' }),
    __metadata("design:type", String)
], Ingredient.prototype, "normalizedName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Scotch Whisky,Scotch', description: 'Comma-separated synonyms for ingredient matching' }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Ingredient.prototype, "synonyms", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'User who created this ingredient (NULL for system ingredients)' }),
    (0, typeorm_1.Column)({ name: 'created_by', nullable: true }),
    __metadata("design:type", Object)
], Ingredient.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'hierarchy_level', default: 0 }),
    __metadata("design:type", Number)
], Ingredient.prototype, "hierarchyLevel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1.0, description: 'Density in g/ml for mass-volume conversions' }),
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, default: 1.0, transformer: new column_numeric_transformer_1.ColumnNumericTransformer() }),
    __metadata("design:type", decimal_js_1.Decimal)
], Ingredient.prototype, "density", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Whether mass-volume conversions are allowed' }),
    (0, typeorm_1.Column)({ name: 'allow_mass_volume_conversion', default: true }),
    __metadata("design:type", Boolean)
], Ingredient.prototype, "allowMassVolumeConversion", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    (0, typeorm_1.BeforeUpdate)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Ingredient.prototype, "normalizeName", null);
exports.Ingredient = Ingredient = __decorate([
    (0, typeorm_1.Entity)('ingredients')
], Ingredient);
//# sourceMappingURL=ingredient.entity.js.map