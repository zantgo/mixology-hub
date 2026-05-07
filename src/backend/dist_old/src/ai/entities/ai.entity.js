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
exports.Ai = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../users/entities/user.entity");
let Ai = class Ai {
    id;
    prompt;
    generated_recipe;
    recipe_data;
    validation_score;
    is_valid;
    saved_as_cocktail_id;
    attempts;
    user;
    created_at;
};
exports.Ai = Ai;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Ai.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], Ai.prototype, "prompt", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { name: 'generated_recipe' }),
    __metadata("design:type", Object)
], Ai.prototype, "generated_recipe", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { name: 'recipe_data', nullable: true }),
    __metadata("design:type", Object)
], Ai.prototype, "recipe_data", void 0);
__decorate([
    (0, typeorm_1.Column)('float', { name: 'validation_score', nullable: true }),
    __metadata("design:type", Number)
], Ai.prototype, "validation_score", void 0);
__decorate([
    (0, typeorm_1.Column)('boolean', { name: 'is_valid', default: false }),
    __metadata("design:type", Boolean)
], Ai.prototype, "is_valid", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { name: 'saved_as_cocktail_id', nullable: true }),
    __metadata("design:type", String)
], Ai.prototype, "saved_as_cocktail_id", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { name: 'attempts', default: 0 }),
    __metadata("design:type", Number)
], Ai.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'created_by' }),
    __metadata("design:type", user_entity_1.User)
], Ai.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Ai.prototype, "created_at", void 0);
exports.Ai = Ai = __decorate([
    (0, typeorm_1.Entity)('ai_generated_recipes')
], Ai);
//# sourceMappingURL=ai.entity.js.map