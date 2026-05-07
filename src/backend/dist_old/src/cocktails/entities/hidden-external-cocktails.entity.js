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
exports.HiddenExternalCocktails = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../users/entities/user.entity");
let HiddenExternalCocktails = class HiddenExternalCocktails {
    externalId;
    hiddenBy;
    reason;
    createdAt;
};
exports.HiddenExternalCocktails = HiddenExternalCocktails;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'external_id' }),
    __metadata("design:type", String)
], HiddenExternalCocktails.prototype, "externalId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'hidden_by' }),
    __metadata("design:type", Object)
], HiddenExternalCocktails.prototype, "hiddenBy", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], HiddenExternalCocktails.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], HiddenExternalCocktails.prototype, "createdAt", void 0);
exports.HiddenExternalCocktails = HiddenExternalCocktails = __decorate([
    (0, typeorm_1.Entity)('hidden_external_cocktails')
], HiddenExternalCocktails);
//# sourceMappingURL=hidden-external-cocktails.entity.js.map