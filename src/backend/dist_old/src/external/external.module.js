"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const the_cocktail_db_service_1 = require("./the-cocktail-db/the-cocktail-db.service");
const enhanced_cocktail_db_service_1 = require("./the-cocktail-db/enhanced-cocktail-db.service");
const llm_adapter_service_1 = require("./llm/llm-adapter.service");
const redis_cache_module_1 = require("../redis-cache/redis-cache.module");
let ExternalModule = class ExternalModule {
};
exports.ExternalModule = ExternalModule;
exports.ExternalModule = ExternalModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule,
            redis_cache_module_1.RedisCacheModule,
        ],
        providers: [the_cocktail_db_service_1.TheCocktailDbService, enhanced_cocktail_db_service_1.EnhancedTheCocktailDbService, llm_adapter_service_1.LlmAdapterService],
        exports: [the_cocktail_db_service_1.TheCocktailDbService, enhanced_cocktail_db_service_1.EnhancedTheCocktailDbService, llm_adapter_service_1.LlmAdapterService],
    })
], ExternalModule);
//# sourceMappingURL=external.module.js.map