"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const users_service_1 = require("./users.service");
const users_controller_1 = require("./users.controller");
const user_entity_1 = require("./entities/user.entity");
const user_inventory_entity_1 = require("./entities/user-inventory.entity");
const user_inventory_service_1 = require("./user-inventory.service");
const user_inventory_controller_1 = require("./user-inventory.controller");
const gdpr_controller_1 = require("./gdpr.controller");
const seeder_service_1 = require("../database/seeder.service");
const ingredient_entity_1 = require("../ingredients/entities/ingredient.entity");
const cocktail_entity_1 = require("../cocktails/entities/cocktail.entity");
const utils_module_1 = require("../utils/utils.module");
const gdpr_data_retention_module_1 = require("./gdpr-data-retention.module");
let UsersModule = class UsersModule {
};
exports.UsersModule = UsersModule;
exports.UsersModule = UsersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, user_inventory_entity_1.UserInventory, ingredient_entity_1.Ingredient, cocktail_entity_1.Cocktail]),
            utils_module_1.UtilsModule,
            gdpr_data_retention_module_1.GdprDataRetentionModule,
        ],
        controllers: [users_controller_1.UsersController, user_inventory_controller_1.UserInventoryController, gdpr_controller_1.GdprController],
        providers: [users_service_1.UsersService, user_inventory_service_1.UserInventoryService, seeder_service_1.SeederService],
        exports: [typeorm_1.TypeOrmModule, users_service_1.UsersService, user_inventory_service_1.UserInventoryService, gdpr_data_retention_module_1.GdprDataRetentionModule],
    })
], UsersModule);
//# sourceMappingURL=users.module.js.map