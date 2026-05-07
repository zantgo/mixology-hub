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
exports.User = void 0;
const typeorm_1 = require("typeorm");
let User = class User {
    id;
    email;
    displayName;
    passwordHash;
    emailVerified;
    emailVerificationToken;
    resetPasswordToken;
    resetPasswordExpires;
    refreshToken;
    failedLoginAttempts;
    accountLockedUntil;
    lastLoginAt;
    gdprDeletionRequested;
    gdprDeletionScheduledAt;
    is_anonymized;
    anonymized_at;
    username;
    first_name;
    last_name;
    profile_picture_url;
    bio;
    date_of_birth;
    createdAt;
    updatedAt;
    isActive;
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'display_name' }),
    __metadata("design:type", String)
], User.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'password_hash' }),
    __metadata("design:type", String)
], User.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_verified', default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "emailVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_verification_token', nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "emailVerificationToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reset_password_token', nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "resetPasswordToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reset_password_expires', nullable: true, type: 'timestamp' }),
    __metadata("design:type", Object)
], User.prototype, "resetPasswordExpires", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'refresh_token', nullable: true, type: 'text' }),
    __metadata("design:type", Object)
], User.prototype, "refreshToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'failed_login_attempts', default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "failedLoginAttempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'account_locked_until', nullable: true, type: 'timestamp' }),
    __metadata("design:type", Object)
], User.prototype, "accountLockedUntil", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_login_at', nullable: true, type: 'timestamp' }),
    __metadata("design:type", Object)
], User.prototype, "lastLoginAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gdpr_deletion_requested', default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "gdprDeletionRequested", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gdpr_deletion_scheduled_at', nullable: true, type: 'timestamp' }),
    __metadata("design:type", Object)
], User.prototype, "gdprDeletionScheduledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_anonymized', default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "is_anonymized", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'anonymized_at', nullable: true, type: 'timestamp' }),
    __metadata("design:type", Object)
], User.prototype, "anonymized_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'username', nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "username", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'first_name', nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "first_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_name', nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "last_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'profile_picture_url', nullable: true, type: 'text' }),
    __metadata("design:type", Object)
], User.prototype, "profile_picture_url", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'bio', nullable: true, type: 'text' }),
    __metadata("design:type", Object)
], User.prototype, "bio", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'date_of_birth', nullable: true, type: 'date' }),
    __metadata("design:type", Object)
], User.prototype, "date_of_birth", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], User.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'is_active', default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)('users')
], User);
//# sourceMappingURL=user.entity.js.map