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
exports.TheCocktailDbService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const cache_manager_1 = require("@nestjs/cache-manager");
const rxjs_1 = require("rxjs");
let TheCocktailDbService = class TheCocktailDbService {
    httpService;
    cacheManager;
    baseUrl = 'https://www.thecocktaildb.com/api/json/v1/1';
    constructor(httpService, cacheManager) {
        this.httpService = httpService;
        this.cacheManager = cacheManager;
    }
    async searchByName(name) {
        const cacheKey = `cocktail_search_${name.toLowerCase()}`;
        const cachedData = await this.cacheManager.get(cacheKey);
        if (cachedData)
            return cachedData;
        const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.baseUrl}/search.php?s=${name}`));
        if (data.drinks) {
            await this.cacheManager.set(cacheKey, data.drinks, 21600000);
        }
        return data.drinks || [];
    }
};
exports.TheCocktailDbService = TheCocktailDbService;
exports.TheCocktailDbService = TheCocktailDbService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [axios_1.HttpService,
        cache_manager_1.Cache])
], TheCocktailDbService);
//# sourceMappingURL=the-cocktail-db.service.js.map