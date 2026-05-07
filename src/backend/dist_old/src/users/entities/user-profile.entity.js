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
exports.UserProfile = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
let UserProfile = class UserProfile {
    id;
    user;
    unitSystem;
    theme;
    defaultServings;
    defaultPartSize;
    showTutorial;
};
exports.UserProfile = UserProfile;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserProfile.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], UserProfile.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'unit_system', default: 'metric' }),
    __metadata("design:type", String)
], UserProfile.prototype, "unitSystem", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'system' }),
    __metadata("design:type", String)
], UserProfile.prototype, "theme", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'default_servings', default: 1 }),
    __metadata("design:type", Number)
], UserProfile.prototype, "defaultServings", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'default_part_size', default: 30 }),
    __metadata("design:type", Number)
], UserProfile.prototype, "defaultPartSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'show_tutorial', default: true }),
    __metadata("design:type", Boolean)
], UserProfile.prototype, "showTutorial", void 0);
exports.UserProfile = UserProfile = __decorate([
    (0, typeorm_1.Entity)('user_profiles')
], UserProfile);
//# sourceMappingURL=user-profile.entity.js.map