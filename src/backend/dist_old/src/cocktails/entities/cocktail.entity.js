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
exports.Cocktail = void 0;
const typeorm_1 = require("typeorm");
const class_transformer_1 = require("class-transformer");
const user_entity_1 = require("../../users/entities/user.entity");
const cocktail_ingredient_entity_1 = require("./cocktail-ingredient.entity");
let Cocktail = class Cocktail {
    id;
    name;
    description;
    instructions;
    is_public;
    source;
    external_id;
    image_full;
    image_thumb;
    is_deleted;
    user;
    ingredients;
    created_at;
};
exports.Cocktail = Cocktail;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    (0, class_transformer_1.Expose)(),
    __metadata("design:type", String)
], Cocktail.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, class_transformer_1.Expose)(),
    __metadata("design:type", String)
], Cocktail.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    (0, class_transformer_1.Expose)(),
    __metadata("design:type", String)
], Cocktail.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    (0, class_transformer_1.Expose)(),
    __metadata("design:type", String)
], Cocktail.prototype, "instructions", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    (0, class_transformer_1.Expose)({ name: 'isPublic' }),
    __metadata("design:type", Boolean)
], Cocktail.prototype, "is_public", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'local' }),
    (0, class_transformer_1.Expose)(),
    __metadata("design:type", String)
], Cocktail.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_transformer_1.Expose)({ name: 'externalId' }),
    __metadata("design:type", String)
], Cocktail.prototype, "external_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'image_full', type: 'varchar', length: 255, nullable: true }),
    (0, class_transformer_1.Expose)({ name: 'imageFull' }),
    __metadata("design:type", String)
], Cocktail.prototype, "image_full", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'image_thumb', type: 'varchar', length: 255, nullable: true }),
    (0, class_transformer_1.Expose)({ name: 'imageThumb' }),
    __metadata("design:type", String)
], Cocktail.prototype, "image_thumb", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_deleted', default: false }),
    (0, class_transformer_1.Expose)({ name: 'isDeleted' }),
    __metadata("design:type", Boolean)
], Cocktail.prototype, "is_deleted", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'created_by' }),
    (0, class_transformer_1.Expose)(),
    __metadata("design:type", user_entity_1.User)
], Cocktail.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => cocktail_ingredient_entity_1.CocktailIngredient, (ci) => ci.cocktail, { cascade: true }),
    (0, class_transformer_1.Expose)(),
    __metadata("design:type", Array)
], Cocktail.prototype, "ingredients", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    (0, class_transformer_1.Expose)({ name: 'createdAt' }),
    __metadata("design:type", Date)
], Cocktail.prototype, "created_at", void 0);
exports.Cocktail = Cocktail = __decorate([
    (0, typeorm_1.Entity)('cocktails')
], Cocktail);
//# sourceMappingURL=cocktail.entity.js.map