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
exports.UserInventory = void 0;
const typeorm_1 = require("typeorm");
const decimal_js_1 = require("decimal.js");
const user_entity_1 = require("./user.entity");
const ingredient_entity_1 = require("../../ingredients/entities/ingredient.entity");
const column_numeric_transformer_1 = require("../../utils/column-numeric.transformer");
let UserInventory = class UserInventory {
    id;
    user;
    ingredient;
    quantity;
    unit;
};
exports.UserInventory = UserInventory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserInventory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], UserInventory.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ingredient_entity_1.Ingredient, { onDelete: 'CASCADE', eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'ingredient_id' }),
    __metadata("design:type", ingredient_entity_1.Ingredient)
], UserInventory.prototype, "ingredient", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 4, default: 0, transformer: new column_numeric_transformer_1.ColumnNumericTransformer() }),
    __metadata("design:type", decimal_js_1.Decimal)
], UserInventory.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'count' }),
    __metadata("design:type", String)
], UserInventory.prototype, "unit", void 0);
exports.UserInventory = UserInventory = __decorate([
    (0, typeorm_1.Entity)('user_inventory'),
    (0, typeorm_1.Unique)(['user', 'ingredient'])
], UserInventory);
//# sourceMappingURL=user-inventory.entity.js.map