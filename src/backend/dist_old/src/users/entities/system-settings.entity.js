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
exports.SystemSettings = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
let SystemSettings = class SystemSettings {
    settingKey;
    settingValue;
    updatedAt;
    updatedBy;
};
exports.SystemSettings = SystemSettings;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'setting_key' }),
    __metadata("design:type", String)
], SystemSettings.prototype, "settingKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'setting_value' }),
    __metadata("design:type", String)
], SystemSettings.prototype, "settingValue", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], SystemSettings.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'updated_by' }),
    __metadata("design:type", Object)
], SystemSettings.prototype, "updatedBy", void 0);
exports.SystemSettings = SystemSettings = __decorate([
    (0, typeorm_1.Entity)('system_settings')
], SystemSettings);
//# sourceMappingURL=system-settings.entity.js.map