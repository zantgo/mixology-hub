"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const ai_service_1 = require("./ai.service");
const enhanced_ai_service_1 = require("./enhanced-ai.service");
const ai_controller_1 = require("./ai.controller");
const ai_entity_1 = require("./entities/ai.entity");
const user_ai_quotas_entity_1 = require("./entities/user-ai-quotas.entity");
const user_entity_1 = require("../users/entities/user.entity");
const ingredient_entity_1 = require("../ingredients/entities/ingredient.entity");
const cocktail_entity_1 = require("../cocktails/entities/cocktail.entity");
const cocktail_ingredient_entity_1 = require("../cocktails/entities/cocktail-ingredient.entity");
const external_module_1 = require("../external/external.module");
const ingredients_module_1 = require("../ingredients/ingredients.module");
let AiModule = class AiModule {
};
exports.AiModule = AiModule;
exports.AiModule = AiModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([ai_entity_1.Ai, user_ai_quotas_entity_1.UserAiQuotas, user_entity_1.User, ingredient_entity_1.Ingredient, cocktail_entity_1.Cocktail, cocktail_ingredient_entity_1.CocktailIngredient]),
            external_module_1.ExternalModule,
            ingredients_module_1.IngredientsModule,
        ],
        controllers: [ai_controller_1.AiController],
        providers: [ai_service_1.AiService, enhanced_ai_service_1.EnhancedAiService],
        exports: [ai_service_1.AiService, enhanced_ai_service_1.EnhancedAiService],
    })
], AiModule);
//# sourceMappingURL=ai.module.js.map