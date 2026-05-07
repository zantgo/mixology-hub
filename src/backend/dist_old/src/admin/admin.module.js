"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const admin_controller_1 = require("./admin.controller");
const admin_service_1 = require("./admin.service");
const reported_content_entity_1 = require("../cocktails/entities/reported-content.entity");
const hidden_external_cocktails_entity_1 = require("../cocktails/entities/hidden-external-cocktails.entity");
const system_settings_entity_1 = require("../users/entities/system-settings.entity");
const user_entity_1 = require("../users/entities/user.entity");
const cocktail_entity_1 = require("../cocktails/entities/cocktail.entity");
const ingredient_entity_1 = require("../ingredients/entities/ingredient.entity");
const auth_module_1 = require("../auth/auth.module");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                reported_content_entity_1.ReportedContent,
                hidden_external_cocktails_entity_1.HiddenExternalCocktails,
                system_settings_entity_1.SystemSettings,
                user_entity_1.User,
                cocktail_entity_1.Cocktail,
                ingredient_entity_1.Ingredient,
            ]),
            auth_module_1.AuthModule,
        ],
        controllers: [admin_controller_1.AdminController],
        providers: [admin_service_1.AdminService],
        exports: [admin_service_1.AdminService],
    })
], AdminModule);
//# sourceMappingURL=admin.module.js.map