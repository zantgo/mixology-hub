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
var GdprDataRetentionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GdprDataRetentionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const schedule_1 = require("@nestjs/schedule");
const user_entity_1 = require("./entities/user.entity");
const user_inventory_entity_1 = require("./entities/user-inventory.entity");
const ai_entity_1 = require("../ai/entities/ai.entity");
const config_1 = require("@nestjs/config");
let GdprDataRetentionService = GdprDataRetentionService_1 = class GdprDataRetentionService {
    userRepository;
    inventoryRepository;
    aiRepository;
    configService;
    logger = new common_1.Logger(GdprDataRetentionService_1.name);
    policy;
    constructor(userRepository, inventoryRepository, aiRepository, configService) {
        this.userRepository = userRepository;
        this.inventoryRepository = inventoryRepository;
        this.aiRepository = aiRepository;
        this.configService = configService;
        this.policy = {
            userInactiveThreshold: parseInt(this.configService.get('GDPR_USER_INACTIVE_THRESHOLD') || '730'),
            userAnonymizeThreshold: parseInt(this.configService.get('GDPR_USER_ANONYMIZE_THRESHOLD') || '365'),
            inventoryHistoryThreshold: parseInt(this.configService.get('GDPR_INVENTORY_THRESHOLD') || '180'),
            aiGeneratedDataThreshold: parseInt(this.configService.get('GDPR_AI_DATA_THRESHOLD') || '90'),
            logDataThreshold: parseInt(this.configService.get('GDPR_LOG_THRESHOLD') || '30'),
        };
    }
    async runDataRetentionCleanup() {
        this.logger.log('Starting GDPR data retention cleanup');
        try {
            const results = {
                anonymizedUsers: 0,
                deletedUsers: 0,
                deletedInventory: 0,
                deletedAiData: 0,
                errors: [],
            };
            results.anonymizedUsers = await this.anonymizeInactiveUsers();
            results.deletedUsers = await this.deleteInactiveUsers();
            results.deletedInventory = await this.cleanupOldInventoryData();
            results.deletedAiData = await this.cleanupOldAiData();
            this.logger.log(`GDPR cleanup completed: ${JSON.stringify(results)}`);
        }
        catch (error) {
            this.logger.error('GDPR data retention cleanup failed', error.stack);
        }
    }
    async anonymizeInactiveUsers() {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - this.policy.userAnonymizeThreshold);
        const usersToAnonymize = await this.userRepository.find({
            where: {
                lastLoginAt: (0, typeorm_2.LessThan)(thresholdDate),
                is_anonymized: false,
            },
            take: 100,
        });
        let anonymizedCount = 0;
        for (const user of usersToAnonymize) {
            try {
                await this.anonymizeUser(user);
                anonymizedCount++;
            }
            catch (error) {
                this.logger.error(`Failed to anonymize user ${user.id}`, error.message);
            }
        }
        this.logger.log(`Anonymized ${anonymizedCount} inactive users`);
        return anonymizedCount;
    }
    async deleteInactiveUsers() {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - this.policy.userInactiveThreshold);
        const usersToDelete = await this.userRepository.find({
            where: {
                lastLoginAt: (0, typeorm_2.LessThan)(thresholdDate),
                is_anonymized: true,
            },
            take: 50,
        });
        let deletedCount = 0;
        for (const user of usersToDelete) {
            try {
                await this.deleteUserData(user.id);
                await this.userRepository.delete(user.id);
                deletedCount++;
            }
            catch (error) {
                this.logger.error(`Failed to delete user ${user.id}`, error.message);
            }
        }
        this.logger.log(`Deleted ${deletedCount} inactive users`);
        return deletedCount;
    }
    async cleanupOldInventoryData() {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - this.policy.inventoryHistoryThreshold);
        const result = await this.inventoryRepository
            .createQueryBuilder('inventory')
            .delete()
            .where('updated_at < :threshold', { threshold: thresholdDate })
            .andWhere('quantity = 0')
            .execute();
        this.logger.log(`Deleted ${result.affected || 0} old inventory items`);
        return result.affected || 0;
    }
    async cleanupOldAiData() {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - this.policy.aiGeneratedDataThreshold);
        const result = await this.aiRepository
            .createQueryBuilder('ai')
            .delete()
            .where('created_at < :threshold', { threshold: thresholdDate })
            .andWhere('saved_as_cocktail_id IS NULL')
            .execute();
        this.logger.log(`Deleted ${result.affected || 0} old AI generated recipes`);
        return result.affected || 0;
    }
    async anonymizeUser(user) {
        const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        user.email = `${anonymousId}@anonymized.mixologyhub`;
        user.username = `user_${anonymousId}`;
        user.first_name = 'Anonymous';
        user.last_name = 'User';
        user.profile_picture_url = null;
        user.bio = null;
        user.date_of_birth = null;
        user.is_anonymized = true;
        user.anonymized_at = new Date();
        await this.userRepository.save(user);
        this.logger.log(`Anonymized user ${user.id} -> ${anonymousId}`);
    }
    async deleteUserData(userId) {
        await this.inventoryRepository.delete({ user: { id: userId } });
        await this.aiRepository.delete({ user: { id: userId } });
        this.logger.log(`Deleted all data for user ${userId}`);
    }
    async exportUserData(userId) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });
        if (!user) {
            throw new Error('User not found');
        }
        const inventory = await this.inventoryRepository.find({
            where: { user: { id: userId } },
            relations: ['ingredient'],
        });
        const aiRecipes = await this.aiRepository.find({
            where: { user: { id: userId } },
        });
        const exportData = {
            userProfile: {
                id: user.id,
                email: user.email,
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name,
                createdAt: user.createdAt,
                lastLogin: user.lastLoginAt,
                isAnonymized: user.is_anonymized,
            },
            inventory: inventory.map(item => ({
                ingredientId: item.ingredient.id,
                ingredientName: item.ingredient.name,
                quantity: item.quantity,
                unit: item.unit,
            })),
            aiGeneratedRecipes: aiRecipes.map(recipe => ({
                id: recipe.id,
                prompt: recipe.prompt,
                generatedAt: recipe.created_at,
                savedAsCocktail: recipe.saved_as_cocktail_id,
                validationScore: recipe.validation_score,
            })),
            exportDate: new Date().toISOString(),
        };
        return exportData;
    }
    async deleteUserAccount(userId) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });
        if (!user) {
            return false;
        }
        try {
            await this.deleteUserData(userId);
            await this.userRepository.delete(userId);
            this.logger.log(`Deleted user account ${userId} (GDPR right to be forgotten)`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to delete user account ${userId}`, error.message);
            return false;
        }
    }
    async getRetentionStats() {
        const now = new Date();
        const userAnonymizeThreshold = new Date(now);
        userAnonymizeThreshold.setDate(userAnonymizeThreshold.getDate() - this.policy.userAnonymizeThreshold);
        const userDeleteThreshold = new Date(now);
        userDeleteThreshold.setDate(userDeleteThreshold.getDate() - this.policy.userInactiveThreshold);
        const inventoryThreshold = new Date(now);
        inventoryThreshold.setDate(inventoryThreshold.getDate() - this.policy.inventoryHistoryThreshold);
        const aiDataThreshold = new Date(now);
        aiDataThreshold.setDate(aiDataThreshold.getDate() - this.policy.aiGeneratedDataThreshold);
        const [usersToAnonymize, usersToDelete, inventoryToCleanup, aiDataToCleanup, totalUsers, totalInventory, totalAiData,] = await Promise.all([
            this.userRepository.count({
                where: {
                    lastLoginAt: (0, typeorm_2.LessThan)(userAnonymizeThreshold),
                    is_anonymized: false,
                },
            }),
            this.userRepository.count({
                where: {
                    lastLoginAt: (0, typeorm_2.LessThan)(userDeleteThreshold),
                    is_anonymized: true,
                },
            }),
            this.inventoryRepository
                .createQueryBuilder('inventory')
                .where('updated_at < :threshold', { threshold: inventoryThreshold })
                .andWhere('quantity = 0')
                .getCount(),
            this.aiRepository
                .createQueryBuilder('ai')
                .where('created_at < :threshold', { threshold: aiDataThreshold })
                .andWhere('saved_as_cocktail_id IS NULL')
                .getCount(),
            this.userRepository.count(),
            this.inventoryRepository.count(),
            this.aiRepository.count(),
        ]);
        return {
            policy: this.policy,
            nextCleanup: {
                usersToAnonymize,
                usersToDelete,
                inventoryToCleanup,
                aiDataToCleanup,
            },
            totals: {
                users: totalUsers,
                inventory: totalInventory,
                aiData: totalAiData,
            },
            lastRun: new Date().toISOString(),
        };
    }
};
exports.GdprDataRetentionService = GdprDataRetentionService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_2AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GdprDataRetentionService.prototype, "runDataRetentionCleanup", null);
exports.GdprDataRetentionService = GdprDataRetentionService = GdprDataRetentionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(user_inventory_entity_1.UserInventory)),
    __param(2, (0, typeorm_1.InjectRepository)(ai_entity_1.Ai)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService])
], GdprDataRetentionService);
//# sourceMappingURL=gdpr-data-retention.service.js.map