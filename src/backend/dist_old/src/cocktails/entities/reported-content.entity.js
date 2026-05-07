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
exports.ReportedContent = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../users/entities/user.entity");
const cocktail_entity_1 = require("./cocktail.entity");
let ReportedContent = class ReportedContent {
    id;
    reportedBy;
    cocktail;
    externalCocktailId;
    reportReason;
    details;
    status;
    reviewedBy;
    createdAt;
    reviewedAt;
};
exports.ReportedContent = ReportedContent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReportedContent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'reported_by' }),
    __metadata("design:type", Object)
], ReportedContent.prototype, "reportedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => cocktail_entity_1.Cocktail, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'cocktail_id' }),
    __metadata("design:type", Object)
], ReportedContent.prototype, "cocktail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_cocktail_id', nullable: true }),
    __metadata("design:type", String)
], ReportedContent.prototype, "externalCocktailId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'report_reason' }),
    __metadata("design:type", String)
], ReportedContent.prototype, "reportReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ReportedContent.prototype, "details", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'pending' }),
    __metadata("design:type", String)
], ReportedContent.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'reviewed_by' }),
    __metadata("design:type", Object)
], ReportedContent.prototype, "reviewedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ReportedContent.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reviewed_at', nullable: true, type: 'timestamp' }),
    __metadata("design:type", Object)
], ReportedContent.prototype, "reviewedAt", void 0);
exports.ReportedContent = ReportedContent = __decorate([
    (0, typeorm_1.Entity)('reported_content')
], ReportedContent);
//# sourceMappingURL=reported-content.entity.js.map