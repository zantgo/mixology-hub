"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CocktailsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const axios_1 = require("@nestjs/axios");
const cocktails_service_1 = require("./cocktails.service");
const cocktails_controller_1 = require("./cocktails.controller");
const cocktail_entity_1 = require("./entities/cocktail.entity");
const cocktail_ingredient_entity_1 = require("./entities/cocktail-ingredient.entity");
const ingredient_entity_1 = require("../ingredients/entities/ingredient.entity");
const user_entity_1 = require("../users/entities/user.entity");
const external_module_1 = require("../external/external.module");
const cocktail_aggregator_service_1 = require("./cocktail-aggregator.service");
const utils_module_1 = require("../utils/utils.module");
const users_module_1 = require("../users/users.module");
const image_service_1 = require("../images/image.service");
let CocktailsModule = class CocktailsModule {
};
exports.CocktailsModule = CocktailsModule;
exports.CocktailsModule = CocktailsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([cocktail_entity_1.Cocktail, cocktail_ingredient_entity_1.CocktailIngredient, ingredient_entity_1.Ingredient, user_entity_1.User]),
            utils_module_1.UtilsModule,
            axios_1.HttpModule,
            external_module_1.ExternalModule,
            (0, common_1.forwardRef)(() => users_module_1.UsersModule),
        ],
        controllers: [cocktails_controller_1.CocktailsController],
        providers: [cocktails_service_1.CocktailsService, cocktail_aggregator_service_1.CocktailAggregatorService, image_service_1.ImageService],
        exports: [cocktail_aggregator_service_1.CocktailAggregatorService],
    })
], CocktailsModule);
//# sourceMappingURL=cocktails.module.js.map