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
var CocktailAggregatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CocktailAggregatorService = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const cocktails_service_1 = require("./cocktails.service");
const enhanced_cocktail_db_service_1 = require("../external/the-cocktail-db/enhanced-cocktail-db.service");
const user_inventory_service_1 = require("../users/user-inventory.service");
let CocktailAggregatorService = CocktailAggregatorService_1 = class CocktailAggregatorService {
    localService;
    externalService;
    inventoryService;
    cacheManager;
    logger = new common_1.Logger(CocktailAggregatorService_1.name);
    constructor(localService, externalService, inventoryService, cacheManager) {
        this.localService = localService;
        this.externalService = externalService;
        this.inventoryService = inventoryService;
        this.cacheManager = cacheManager;
    }
    async searchUnified(name, paginationQuery, options = {}, userId) {
        try {
            const { limit = 10, page = 1 } = paginationQuery;
            const offset = (page - 1) * limit;
            if (name && name.trim().length > 100) {
                throw new common_1.BadRequestException('Search query too long');
            }
            const sanitizedName = name ? name.trim() : '';
            const cacheKey = this.generateSearchCacheKey(sanitizedName, options, userId);
            let cachedResults = await this.cacheManager.get(`search:${cacheKey}`);
            if (!cachedResults) {
                cachedResults = await this.fetchSearchResults(sanitizedName, options, userId);
                await this.cacheManager.set(`search:${cacheKey}`, cachedResults, 300);
            }
            const paginatedList = cachedResults.slice(offset, offset + limit);
            const totalItems = cachedResults.length;
            const totalPages = Math.ceil(totalItems / limit);
            const hasNextPage = page < totalPages;
            const localCount = paginatedList.filter(item => item.source === 'local').length;
            const externalCount = paginatedList.filter(item => item.source === 'api').length;
            const metadata = {
                sources: {
                    local: localCount,
                    external: externalCount,
                    total: totalItems,
                },
                filters: options.filters || {},
                sort: {
                    by: options.sortBy || 'name',
                    order: options.sortOrder || 'asc',
                },
            };
            return {
                data: paginatedList,
                meta: {
                    currentPage: page,
                    nextPage: hasNextPage ? page + 1 : null,
                    itemsPerPage: limit,
                    totalItems: totalItems,
                    totalPages: totalPages
                },
                metadata,
            };
        }
        catch (err) {
            this.logger.error('Enhanced search unified failed:', err);
            const { limit = 10, page = 1 } = paginationQuery;
            return {
                data: [],
                meta: {
                    currentPage: page,
                    nextPage: null,
                    itemsPerPage: limit,
                    totalItems: 0,
                    totalPages: 0
                },
                metadata: {
                    error: 'Search failed',
                    sources: { local: 0, external: 0, total: 0 },
                },
            };
        }
    }
    applyFilters(cocktails, filters) {
        return cocktails.filter(cocktail => {
            if (filters.ingredient) {
                const hasIngredient = cocktail.ingredients.some((ing) => ing.ingredient.name.toLowerCase().includes(filters.ingredient.toLowerCase()));
                if (!hasIngredient)
                    return false;
            }
            if (filters.alcoholic !== undefined) {
            }
            if (filters.glassType) {
            }
            if (filters.minIngredients !== undefined || filters.maxIngredients !== undefined) {
                const ingredientCount = cocktail.ingredients.length;
                if (filters.minIngredients !== undefined && ingredientCount < filters.minIngredients) {
                    return false;
                }
                if (filters.maxIngredients !== undefined && ingredientCount > filters.maxIngredients) {
                    return false;
                }
            }
            return true;
        });
    }
    async calculateMakeabilityScores(cocktails, userId) {
        try {
            const inventory = await this.inventoryService.getInventory(userId);
            return cocktails.map(cocktail => {
                const makeabilityScore = this.calculateMakeabilityScore(cocktail, inventory);
                return {
                    ...cocktail,
                    makeabilityScore,
                    isMakeable: makeabilityScore >= 0.8,
                };
            });
        }
        catch (error) {
            this.logger.warn('Failed to calculate makeability scores:', error);
            return cocktails.map(cocktail => ({
                ...cocktail,
                makeabilityScore: 0,
                isMakeable: false,
            }));
        }
    }
    calculateMakeabilityScore(cocktail, inventory) {
        if (!cocktail.ingredients || cocktail.ingredients.length === 0) {
            return 0;
        }
        let matchedIngredients = 0;
        for (const cocktailIngredient of cocktail.ingredients) {
            const requiredIngredient = cocktailIngredient.ingredient;
            const directMatch = inventory.find(item => item.ingredient.id === requiredIngredient.id ||
                item.ingredient.name.toLowerCase() === requiredIngredient.name.toLowerCase());
            if (directMatch) {
                matchedIngredients++;
                continue;
            }
        }
        return matchedIngredients / cocktail.ingredients.length;
    }
    sortCocktails(cocktails, sortBy, sortOrder) {
        const order = sortOrder === 'desc' ? -1 : 1;
        return [...cocktails].sort((a, b) => {
            switch (sortBy) {
                case 'makeability':
                    const scoreA = a.makeabilityScore || 0;
                    const scoreB = b.makeabilityScore || 0;
                    return (scoreB - scoreA) * order;
                case 'complexity':
                    const complexityA = a.ingredients?.length || 0;
                    const complexityB = b.ingredients?.length || 0;
                    return (complexityB - complexityA) * order;
                case 'popularity':
                    return 0;
                case 'name':
                default:
                    const nameA = a.name?.toLowerCase() || '';
                    const nameB = b.name?.toLowerCase() || '';
                    return nameA.localeCompare(nameB) * order;
            }
        });
    }
    async mapExternalToLocal(drink) {
        if (!drink || !drink.idDrink || !drink.strDrink) {
            return null;
        }
        const ingredients = [];
        let totalVolumeMl = 0;
        for (let i = 1; i <= 15; i++) {
            const ingredientName = drink[`strIngredient${i}`];
            const measure = drink[`strMeasure${i}`];
            if (ingredientName && ingredientName.trim() !== '') {
                const parsedMeasure = this.parseMeasure(measure);
                ingredients.push({
                    measure: measure ? measure.trim() : 'to taste',
                    amount: parsedMeasure.amount,
                    unit: parsedMeasure.unit,
                    ingredient: {
                        id: `ext-${drink.idDrink}-${i}`,
                        name: ingredientName.trim().toLowerCase(),
                        externalId: `thecocktaildb:${ingredientName.trim().toLowerCase()}`,
                    }
                });
                if (parsedMeasure.unit === 'ml' || parsedMeasure.unit === 'oz') {
                    totalVolumeMl += parsedMeasure.unit === 'oz' ? parsedMeasure.amount * 29.57 : parsedMeasure.amount;
                }
            }
        }
        const complexityScore = this.calculateComplexityScore(ingredients.length, totalVolumeMl);
        const imageFull = null;
        const imageThumb = null;
        return {
            id: `ext-${drink.idDrink}`,
            externalId: drink.idDrink,
            name: drink.strDrink,
            description: drink.strInstructions ? `Public recipe from TheCocktailDB: ${drink.strInstructions.substring(0, 100)}...` : 'Public recipe from TheCocktailDB',
            instructions: drink.strInstructions || 'No instructions provided',
            is_public: true,
            source: 'api',
            image_full: imageFull,
            image_thumb: imageThumb,
            category: drink.strCategory || null,
            alcoholic: drink.strAlcoholic === 'Alcoholic',
            glass: drink.strGlass || null,
            tags: drink.strTags ? drink.strTags.split(',') : [],
            ingredients: ingredients,
            metadata: {
                complexityScore,
                ingredientCount: ingredients.length,
                estimatedVolumeMl: Math.round(totalVolumeMl),
                lastUpdated: new Date().toISOString(),
                source: 'thecocktaildb',
            }
        };
    }
    parseMeasure(measure) {
        if (!measure) {
            return { amount: 1, unit: 'parts' };
        }
        const measureStr = measure.trim().toLowerCase();
        const mixedFractionMatch = measureStr.match(/^(\d+)\s+(\d+)\/(\d+)\s*(.+)$/);
        if (mixedFractionMatch) {
            const whole = parseInt(mixedFractionMatch[1], 10);
            const num = parseInt(mixedFractionMatch[2], 10);
            const den = parseInt(mixedFractionMatch[3], 10);
            const unit = mixedFractionMatch[4].trim();
            return { amount: whole + num / den, unit };
        }
        const fractionMatch = measureStr.match(/^(\d+)\/(\d+)\s*(.+)$/);
        if (fractionMatch) {
            const num = parseInt(fractionMatch[1], 10);
            const den = parseInt(fractionMatch[2], 10);
            const unit = fractionMatch[3].trim();
            return { amount: num / den, unit };
        }
        const patterns = [
            { regex: /(\d+(?:\.\d+)?)\s*ml/, unit: 'ml' },
            { regex: /(\d+(?:\.\d+)?)\s*oz/, unit: 'oz' },
            { regex: /(\d+(?:\.\d+)?)\s*cl/, unit: 'cl' },
            { regex: /(\d+(?:\.\d+)?)\s*dash(?:es)?/, unit: 'dashes' },
            { regex: /(\d+(?:\.\d+)?)\s*drop(?:s)?/, unit: 'drops' },
            { regex: /(\d+(?:\.\d+)?)\s*splash(?:es)?/, unit: 'splashes' },
            { regex: /(\d+(?:\.\d+)?)\s*part(?:s)?/, unit: 'parts' },
            { regex: /(\d+(?:\.\d+)?)\s*slice(?:s)?/, unit: 'slices' },
            { regex: /(\d+(?:\.\d+)?)\s*wedge(?:s)?/, unit: 'wedges' },
            { regex: /(\d+(?:\.\d+)?)\s*twist(?:s)?/, unit: 'twists' },
            { regex: /(\d+(?:\.\d+)?)\s*sprig(?:s)?/, unit: 'sprigs' },
            { regex: /(\d+(?:\.\d+)?)\s*leaf(?:ves)?/, unit: 'leaves' },
        ];
        for (const pattern of patterns) {
            const match = measureStr.match(pattern.regex);
            if (match) {
                return { amount: parseFloat(match[1]), unit: pattern.unit };
            }
        }
        const numberMatch = measureStr.match(/(\d+(?:\.\d+)?)/);
        if (numberMatch) {
            return { amount: parseFloat(numberMatch[1]), unit: 'parts' };
        }
        if (measureStr.includes('pinch') || measureStr.includes('dash')) {
            return { amount: 1, unit: 'dashes' };
        }
        if (measureStr.includes('splash')) {
            return { amount: 1, unit: 'splashes' };
        }
        if (measureStr.includes('to taste') || measureStr.includes('garnish')) {
            return { amount: 1, unit: 'count' };
        }
        return { amount: 1, unit: 'parts' };
    }
    calculateComplexityScore(ingredientCount, totalVolumeMl) {
        let score = 0;
        if (ingredientCount <= 3)
            score += 1;
        else if (ingredientCount <= 5)
            score += 2;
        else if (ingredientCount <= 7)
            score += 3;
        else
            score += 4;
        if (totalVolumeMl > 200)
            score += 1;
        if (totalVolumeMl > 300)
            score += 1;
        return Math.min(5, score);
    }
    generateSearchCacheKey(name, options, userId) {
        const keyParts = [
            'search',
            name || 'all',
            options.includeLocal ? 'local' : '',
            options.includeExternal ? 'external' : '',
            options.sortBy || 'name',
            options.sortOrder || 'asc',
            userId || 'anonymous',
            JSON.stringify(options.filters || {}),
        ];
        return keyParts.filter(part => part).join(':');
    }
    async fetchSearchResults(name, options, userId) {
        const [localCocktails, externalCocktails] = await Promise.all([
            options.includeLocal !== false ? this.fetchLocalCocktails(name) : Promise.resolve([]),
            options.includeExternal !== false ? this.fetchExternalCocktails(name) : Promise.resolve([]),
        ]);
        const normalizedExternal = Array.isArray(externalCocktails)
            ? (await Promise.all(externalCocktails.map(drink => this.mapExternalToLocal(drink)))).filter(Boolean)
            : [];
        let unifiedList = [...localCocktails, ...normalizedExternal];
        if (options.filters) {
            unifiedList = this.applyFilters(unifiedList, options.filters);
        }
        if (userId) {
            unifiedList = await this.calculateMakeabilityScores(unifiedList, userId);
        }
        unifiedList = this.sortCocktails(unifiedList, options.sortBy, options.sortOrder);
        return unifiedList;
    }
    async fetchLocalCocktails(name) {
        try {
            const response = await this.localService.findAll({ limit: 10000, page: 1 });
            const localCocktails = response.data;
            if (!name) {
                return localCocktails;
            }
            return localCocktails.filter(c => c.name.toLowerCase().includes(name.toLowerCase()) ||
                (c.description && c.description.toLowerCase().includes(name.toLowerCase())) ||
                c.ingredients.some(ing => ing.ingredient.name.toLowerCase().includes(name.toLowerCase())));
        }
        catch (error) {
            this.logger.warn('Failed to fetch local cocktails:', error);
            return [];
        }
    }
    async fetchExternalCocktails(name) {
        try {
            if (!name) {
                const randomCocktails = [];
                for (let i = 0; i < 5; i++) {
                    try {
                        const random = await this.externalService.getRandomCocktail();
                        if (random)
                            randomCocktails.push(random);
                    }
                    catch (error) {
                    }
                }
                return randomCocktails;
            }
            return await this.externalService.searchByName(name);
        }
        catch (error) {
            this.logger.warn('Failed to fetch external cocktails:', error);
            return [];
        }
    }
};
exports.CocktailAggregatorService = CocktailAggregatorService;
exports.CocktailAggregatorService = CocktailAggregatorService = CocktailAggregatorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [cocktails_service_1.CocktailsService,
        enhanced_cocktail_db_service_1.EnhancedTheCocktailDbService,
        user_inventory_service_1.UserInventoryService, Object])
], CocktailAggregatorService);
//# sourceMappingURL=cocktail-aggregator.service.js.map