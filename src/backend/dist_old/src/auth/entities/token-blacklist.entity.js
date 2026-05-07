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
exports.TokenBlacklist = void 0;
const typeorm_1 = require("typeorm");
let TokenBlacklist = class TokenBlacklist {
    id;
    token;
    reason;
    blacklistedAt;
    expiresAt;
};
exports.TokenBlacklist = TokenBlacklist;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TokenBlacklist.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], TokenBlacklist.prototype, "token", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TokenBlacklist.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'blacklisted_at' }),
    __metadata("design:type", Date)
], TokenBlacklist.prototype, "blacklistedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamp' }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], TokenBlacklist.prototype, "expiresAt", void 0);
exports.TokenBlacklist = TokenBlacklist = __decorate([
    (0, typeorm_1.Entity)('token_blacklist')
], TokenBlacklist);
//# sourceMappingURL=token-blacklist.entity.js.map