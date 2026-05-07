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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const reported_content_entity_1 = require("../cocktails/entities/reported-content.entity");
const hidden_external_cocktails_entity_1 = require("../cocktails/entities/hidden-external-cocktails.entity");
const system_settings_entity_1 = require("../users/entities/system-settings.entity");
const ingredient_entity_1 = require("../ingredients/entities/ingredient.entity");
let AdminService = class AdminService {
    reportRepository;
    hiddenRepository;
    settingsRepository;
    ingredientRepository;
    constructor(reportRepository, hiddenRepository, settingsRepository, ingredientRepository) {
        this.reportRepository = reportRepository;
        this.hiddenRepository = hiddenRepository;
        this.settingsRepository = settingsRepository;
        this.ingredientRepository = ingredientRepository;
    }
    async getReports() {
        return this.reportRepository.find({
            where: { status: 'pending' },
            order: { createdAt: 'DESC' },
        });
    }
    async reviewReport(id, status, reviewedBy) {
        const report = await this.reportRepository.findOne({ where: { id } });
        if (!report) {
            throw new common_1.NotFoundException('Report not found');
        }
        report.status = status;
        report.reviewedBy = { id: reviewedBy };
        report.reviewedAt = new Date();
        return this.reportRepository.save(report);
    }
    async mergeIngredients(sourceId, targetId, adminId) {
        const source = await this.ingredientRepository.findOne({ where: { id: sourceId } });
        const target = await this.ingredientRepository.findOne({ where: { id: targetId } });
        if (!source || !target) {
            throw new common_1.NotFoundException('Source or target ingredient not found');
        }
        const children = await this.ingredientRepository.find({
            where: { parent: { id: sourceId } },
        });
        for (const child of children) {
            child.parent = target;
            await this.ingredientRepository.save(child);
        }
        await this.ingredientRepository.remove(source);
        return { message: 'Ingredients merged successfully', targetId };
    }
    async hideExternalCocktail(externalId, reason, adminId) {
        const existing = await this.hiddenRepository.findOne({
            where: { externalId },
        });
        if (existing) {
            existing.reason = reason;
            return this.hiddenRepository.save(existing);
        }
        const hidden = this.hiddenRepository.create({
            externalId,
            reason,
            hiddenBy: { id: adminId },
        });
        return this.hiddenRepository.save(hidden);
    }
    async unhideExternalCocktail(externalId) {
        await this.hiddenRepository.delete({ externalId });
        return { message: 'External cocktail unhidden' };
    }
    async getSetting(key) {
        const setting = await this.settingsRepository.findOne({ where: { settingKey: key } });
        if (!setting) {
            throw new common_1.NotFoundException('Setting not found');
        }
        return setting;
    }
    async setSetting(key, value, updatedBy) {
        let setting = await this.settingsRepository.findOne({ where: { settingKey: key } });
        if (!setting) {
            setting = this.settingsRepository.create({
                settingKey: key,
                settingValue: value,
                updatedBy: { id: updatedBy },
            });
        }
        else {
            setting.settingValue = value;
            setting.updatedBy = { id: updatedBy };
        }
        return this.settingsRepository.save(setting);
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(reported_content_entity_1.ReportedContent)),
    __param(1, (0, typeorm_1.InjectRepository)(hidden_external_cocktails_entity_1.HiddenExternalCocktails)),
    __param(2, (0, typeorm_1.InjectRepository)(system_settings_entity_1.SystemSettings)),
    __param(3, (0, typeorm_1.InjectRepository)(ingredient_entity_1.Ingredient)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AdminService);
//# sourceMappingURL=admin.service.js.map