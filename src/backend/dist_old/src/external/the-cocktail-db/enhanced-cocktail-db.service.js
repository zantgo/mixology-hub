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
var EnhancedTheCocktailDbService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedTheCocktailDbService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const cache_manager_1 = require("@nestjs/cache-manager");
const rxjs_1 = require("rxjs");
const axios_2 = require("axios");
const config_1 = require("@nestjs/config");
let EnhancedTheCocktailDbService = EnhancedTheCocktailDbService_1 = class EnhancedTheCocktailDbService {
    httpService;
    cacheManager;
    configService;
    baseUrl = 'https://www.thecocktaildb.com/api/json/v1/1';
    logger = new common_1.Logger(EnhancedTheCocktailDbService_1.name);
    circuitBreaker = {
        failures: 0,
        lastFailure: 0,
        state: 'CLOSED',
        nextAttempt: 0,
    };
    circuitBreakerThreshold = 5;
    circuitBreakerResetTimeout = 60000;
    rateLimitWindow = 60000;
    rateLimitMaxRequests = 30;
    requestTimestamps = [];
    constructor(httpService, cacheManager, configService) {
        this.httpService = httpService;
        this.cacheManager = cacheManager;
        this.configService = configService;
    }
    async searchByName(name, options) {
        if (!name || name.trim().length === 0) {
            throw new common_1.BadRequestException('Search name cannot be empty');
        }
        const sanitizedName = this.sanitizeInput(name);
        if (!this.isCircuitClosed()) {
            this.logger.warn(`Circuit breaker is OPEN for TheCocktailDB API`);
            throw new common_1.InternalServerErrorException('External API is temporarily unavailable');
        }
        if (!this.checkRateLimit()) {
            this.logger.warn(`Rate limit exceeded for TheCocktailDB API`);
            throw new common_1.InternalServerErrorException('Rate limit exceeded for external API');
        }
        const cacheKey = `cocktail_search_${sanitizedName.toLowerCase()}`;
        if (!options?.bypassCache) {
            const cachedData = await this.cacheManager.get(cacheKey);
            if (cachedData) {
                this.logger.debug(`Cache hit for search: ${sanitizedName}`);
                return cachedData;
            }
        }
        try {
            this.recordRequest();
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.baseUrl}/search.php?s=${encodeURIComponent(sanitizedName)}`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'MixologyHub/1.0',
                },
            }));
            this.resetCircuitBreaker();
            const sanitizedData = this.sanitizeResponse(data);
            const cacheTtl = sanitizedData.drinks?.length > 0 ? 21600000 : 300000;
            await this.cacheManager.set(cacheKey, sanitizedData.drinks || [], cacheTtl);
            this.logger.log(`Successfully fetched ${sanitizedData.drinks?.length || 0} cocktails from TheCocktailDB`);
            return sanitizedData.drinks || [];
        }
        catch (error) {
            this.handleCircuitBreakerFailure(error);
            if (error instanceof axios_2.AxiosError) {
                if (error.code === 'ECONNABORTED') {
                    this.logger.error(`TheCocktailDB API timeout for search: ${sanitizedName}`);
                    throw new common_1.InternalServerErrorException('External API timeout');
                }
                else if (error.response?.status === 429) {
                    this.logger.error(`TheCocktailDB API rate limit exceeded for search: ${sanitizedName}`);
                    throw new common_1.InternalServerErrorException('External API rate limit exceeded');
                }
                else if (error.response?.status && error.response.status >= 500) {
                    this.logger.error(`TheCocktailDB API server error (${error.response.status}) for search: ${sanitizedName}`);
                    throw new common_1.InternalServerErrorException('External API server error');
                }
            }
            this.logger.error(`Failed to fetch from TheCocktailDB for search: ${sanitizedName}`, error);
            throw new common_1.InternalServerErrorException('Failed to fetch from external API');
        }
    }
    async searchByIngredient(ingredient) {
        const sanitizedIngredient = this.sanitizeInput(ingredient);
        if (!this.isCircuitClosed()) {
            throw new common_1.InternalServerErrorException('External API is temporarily unavailable');
        }
        if (!this.checkRateLimit()) {
            throw new common_1.InternalServerErrorException('Rate limit exceeded for external API');
        }
        const cacheKey = `cocktail_by_ingredient_${sanitizedIngredient.toLowerCase()}`;
        const cachedData = await this.cacheManager.get(cacheKey);
        if (cachedData)
            return cachedData;
        try {
            this.recordRequest();
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.baseUrl}/filter.php?i=${encodeURIComponent(sanitizedIngredient)}`, {
                timeout: 10000,
            }));
            this.resetCircuitBreaker();
            const sanitizedData = this.sanitizeResponse(data);
            await this.cacheManager.set(cacheKey, sanitizedData.drinks || [], 21600000);
            return sanitizedData.drinks || [];
        }
        catch (error) {
            this.handleCircuitBreakerFailure(error);
            this.logger.error(`Failed to fetch cocktails by ingredient: ${sanitizedIngredient}`, error);
            throw new common_1.InternalServerErrorException('Failed to fetch from external API');
        }
    }
    async getCocktailById(id) {
        if (!this.isCircuitClosed()) {
            throw new common_1.InternalServerErrorException('External API is temporarily unavailable');
        }
        if (!this.checkRateLimit()) {
            throw new common_1.InternalServerErrorException('Rate limit exceeded for external API');
        }
        const cacheKey = `cocktail_by_id_${id}`;
        const cachedData = await this.cacheManager.get(cacheKey);
        if (cachedData)
            return cachedData;
        try {
            this.recordRequest();
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.baseUrl}/lookup.php?i=${encodeURIComponent(id)}`, {
                timeout: 10000,
            }));
            this.resetCircuitBreaker();
            const sanitizedData = this.sanitizeResponse(data);
            await this.cacheManager.set(cacheKey, sanitizedData.drinks?.[0] || null, 86400000);
            return sanitizedData.drinks?.[0] || null;
        }
        catch (error) {
            this.handleCircuitBreakerFailure(error);
            this.logger.error(`Failed to fetch cocktail by ID: ${id}`, error);
            throw new common_1.InternalServerErrorException('Failed to fetch from external API');
        }
    }
    async getRandomCocktail() {
        if (!this.isCircuitClosed()) {
            throw new common_1.InternalServerErrorException('External API is temporarily unavailable');
        }
        if (!this.checkRateLimit()) {
            throw new common_1.InternalServerErrorException('Rate limit exceeded for external API');
        }
        const cacheKey = 'random_cocktail';
        const cachedData = await this.cacheManager.get(cacheKey);
        if (cachedData)
            return cachedData;
        try {
            this.recordRequest();
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.baseUrl}/random.php`, {
                timeout: 10000,
            }));
            this.resetCircuitBreaker();
            const sanitizedData = this.sanitizeResponse(data);
            await this.cacheManager.set(cacheKey, sanitizedData.drinks?.[0] || null, 300000);
            return sanitizedData.drinks?.[0] || null;
        }
        catch (error) {
            this.handleCircuitBreakerFailure(error);
            this.logger.error('Failed to fetch random cocktail', error);
            throw new common_1.InternalServerErrorException('Failed to fetch from external API');
        }
    }
    getCircuitBreakerState() {
        return { ...this.circuitBreaker };
    }
    resetCircuitBreakerManually() {
        this.circuitBreaker = {
            failures: 0,
            lastFailure: 0,
            state: 'CLOSED',
            nextAttempt: 0,
        };
        this.logger.log('Circuit breaker manually reset');
    }
    sanitizeInput(input) {
        return input.trim().replace(/[<>"'`]/g, '');
    }
    sanitizeResponse(data) {
        if (!data || typeof data !== 'object') {
            return { drinks: [] };
        }
        if (!Array.isArray(data.drinks)) {
            return { drinks: [] };
        }
        const sanitizedDrinks = data.drinks.map((drink) => {
            if (!drink || typeof drink !== 'object')
                return null;
            const sanitizedDrink = {};
            const stringFields = ['strDrink', 'strInstructions', 'strDrinkThumb', 'strImageSource', 'strImageAttribution'];
            const idFields = ['idDrink'];
            stringFields.forEach(field => {
                if (drink[field] && typeof drink[field] === 'string') {
                    sanitizedDrink[field] = drink[field].replace(/[<>"'`]/g, '');
                }
            });
            idFields.forEach(field => {
                if (drink[field]) {
                    sanitizedDrink[field] = String(drink[field]);
                }
            });
            for (let i = 1; i <= 15; i++) {
                const ingredientField = `strIngredient${i}`;
                const measureField = `strMeasure${i}`;
                if (drink[ingredientField] && typeof drink[ingredientField] === 'string') {
                    sanitizedDrink[ingredientField] = drink[ingredientField].replace(/[<>"'`]/g, '').trim();
                }
                if (drink[measureField] && typeof drink[measureField] === 'string') {
                    sanitizedDrink[measureField] = drink[measureField].replace(/[<>"'`]/g, '').trim();
                }
            }
            return sanitizedDrink;
        }).filter(Boolean);
        return { drinks: sanitizedDrinks };
    }
    isCircuitClosed() {
        const now = Date.now();
        if (this.circuitBreaker.state === 'OPEN') {
            if (now >= this.circuitBreaker.nextAttempt) {
                this.circuitBreaker.state = 'HALF_OPEN';
                this.logger.log('Circuit breaker transitioned to HALF_OPEN');
                return true;
            }
            return false;
        }
        return true;
    }
    handleCircuitBreakerFailure(error) {
        const now = Date.now();
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailure = now;
        if (this.circuitBreaker.failures >= this.circuitBreakerThreshold) {
            this.circuitBreaker.state = 'OPEN';
            this.circuitBreaker.nextAttempt = now + this.circuitBreakerResetTimeout;
            this.logger.error(`Circuit breaker OPENED after ${this.circuitBreaker.failures} failures`);
        }
        else if (this.circuitBreaker.state === 'HALF_OPEN') {
            this.circuitBreaker.state = 'OPEN';
            this.circuitBreaker.nextAttempt = now + this.circuitBreakerResetTimeout;
            this.logger.error('Circuit breaker re-OPENED after HALF_OPEN failure');
        }
    }
    resetCircuitBreaker() {
        if (this.circuitBreaker.state === 'HALF_OPEN') {
            this.circuitBreaker.state = 'CLOSED';
            this.circuitBreaker.failures = 0;
            this.logger.log('Circuit breaker CLOSED after successful HALF_OPEN request');
        }
        else if (this.circuitBreaker.failures > 0) {
            this.circuitBreaker.failures = 0;
        }
    }
    checkRateLimit() {
        const now = Date.now();
        const windowStart = now - this.rateLimitWindow;
        this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > windowStart);
        if (this.requestTimestamps.length >= this.rateLimitMaxRequests) {
            return false;
        }
        return true;
    }
    recordRequest() {
        this.requestTimestamps.push(Date.now());
        const twoMinutesAgo = Date.now() - 120000;
        this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > twoMinutesAgo);
    }
};
exports.EnhancedTheCocktailDbService = EnhancedTheCocktailDbService;
exports.EnhancedTheCocktailDbService = EnhancedTheCocktailDbService = EnhancedTheCocktailDbService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [axios_1.HttpService,
        cache_manager_1.Cache,
        config_1.ConfigService])
], EnhancedTheCocktailDbService);
//# sourceMappingURL=enhanced-cocktail-db.service.js.map