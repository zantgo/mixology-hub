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
exports.GdprController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const gdpr_data_retention_service_1 = require("./gdpr-data-retention.service");
const swagger_1 = require("@nestjs/swagger");
let GdprController = class GdprController {
    gdprService;
    constructor(gdprService) {
        this.gdprService = gdprService;
    }
    async exportUserData(req) {
        const data = await this.gdprService.exportUserData(req.user.id);
        return {
            success: true,
            data,
            exportedAt: new Date().toISOString(),
        };
    }
    async requestAccountDeletion(req) {
        const success = await this.gdprService.deleteUserAccount(req.user.id);
        return {
            success,
            message: success
                ? 'Your account and all associated data have been deleted.'
                : 'Failed to delete account. Please contact support.',
            deletedAt: new Date().toISOString(),
        };
    }
    async getRetentionStats(req) {
        const stats = await this.gdprService.getRetentionStats();
        return {
            success: true,
            stats,
            requestedBy: req.user.id,
        };
    }
    async runCleanup(req) {
        this.gdprService.runDataRetentionCleanup();
        return {
            success: true,
            message: 'GDPR data cleanup has been triggered. Check logs for details.',
            triggeredAt: new Date().toISOString(),
            triggeredBy: req.user.id,
        };
    }
};
exports.GdprController = GdprController;
__decorate([
    (0, common_1.Get)('export-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Export all user data (GDPR right to access)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User data exported successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GdprController.prototype, "exportUserData", null);
__decorate([
    (0, common_1.Post)('request-deletion'),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, swagger_1.ApiOperation)({ summary: 'Request account deletion (GDPR right to be forgotten)' }),
    (0, swagger_1.ApiResponse)({ status: 202, description: 'Deletion request accepted' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GdprController.prototype, "requestAccountDeletion", null);
__decorate([
    (0, common_1.Get)('retention-stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get data retention statistics (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Retention statistics retrieved' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Admin access required' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GdprController.prototype, "getRetentionStats", null);
__decorate([
    (0, common_1.Post)('run-cleanup'),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, swagger_1.ApiOperation)({ summary: 'Manually trigger GDPR data cleanup (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 202, description: 'Cleanup triggered successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Admin access required' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GdprController.prototype, "runCleanup", null);
exports.GdprController = GdprController = __decorate([
    (0, swagger_1.ApiTags)('GDPR'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('gdpr'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [gdpr_data_retention_service_1.GdprDataRetentionService])
], GdprController);
//# sourceMappingURL=gdpr.controller.js.map