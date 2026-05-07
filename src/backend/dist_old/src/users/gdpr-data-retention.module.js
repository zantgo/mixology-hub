"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GdprDataRetentionModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const schedule_1 = require("@nestjs/schedule");
const gdpr_data_retention_service_1 = require("./gdpr-data-retention.service");
const user_entity_1 = require("./entities/user.entity");
const user_inventory_entity_1 = require("./entities/user-inventory.entity");
const ai_entity_1 = require("../ai/entities/ai.entity");
let GdprDataRetentionModule = class GdprDataRetentionModule {
};
exports.GdprDataRetentionModule = GdprDataRetentionModule;
exports.GdprDataRetentionModule = GdprDataRetentionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, user_inventory_entity_1.UserInventory, ai_entity_1.Ai]),
            schedule_1.ScheduleModule.forRoot(),
        ],
        providers: [gdpr_data_retention_service_1.GdprDataRetentionService],
        exports: [gdpr_data_retention_service_1.GdprDataRetentionService],
    })
], GdprDataRetentionModule);
//# sourceMappingURL=gdpr-data-retention.module.js.map