"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_module_1 = require("./database/database.module");
const redis_cache_module_1 = require("./redis-cache/redis-cache.module");
const external_module_1 = require("./external/external.module");
const users_module_1 = require("./users/users.module");
const cocktails_module_1 = require("./cocktails/cocktails.module");
const ingredients_module_1 = require("./ingredients/ingredients.module");
const favorites_module_1 = require("./favorites/favorites.module");
const ai_module_1 = require("./ai/ai.module");
const utils_module_1 = require("./utils/utils.module");
const auth_module_1 = require("./auth/auth.module");
const admin_module_1 = require("./admin/admin.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env', '../.env'],
            }),
            database_module_1.DatabaseModule,
            redis_cache_module_1.RedisCacheModule,
            external_module_1.ExternalModule,
            users_module_1.UsersModule,
            cocktails_module_1.CocktailsModule,
            ingredients_module_1.IngredientsModule,
            favorites_module_1.FavoritesModule,
            ai_module_1.AiModule,
            utils_module_1.UtilsModule,
            auth_module_1.AuthModule,
            admin_module_1.AdminModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map