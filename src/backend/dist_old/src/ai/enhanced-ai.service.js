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
var EnhancedAiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedAiService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const ai_entity_1 = require("./entities/ai.entity");
const user_ai_quotas_entity_1 = require("./entities/user-ai-quotas.entity");
const user_entity_1 = require("../users/entities/user.entity");
const ingredient_entity_1 = require("../ingredients/entities/ingredient.entity");
const cocktail_entity_1 = require("../cocktails/entities/cocktail.entity");
const cocktail_ingredient_entity_1 = require("../cocktails/entities/cocktail-ingredient.entity");
const hierarchical_ingredient_service_1 = require("../ingredients/hierarchical-ingredient.service");
const enhanced_cocktail_db_service_1 = require("../external/the-cocktail-db/enhanced-cocktail-db.service");
const llm_adapter_service_1 = require("../external/llm/llm-adapter.service");
let EnhancedAiService = EnhancedAiService_1 = class EnhancedAiService {
    aiRepository;
    quotaRepository;
    userRepository;
    ingredientRepository;
    cocktailRepository;
    hierarchicalIngredientService;
    externalService;
    llmAdapterService;
    configService;
    logger = new common_1.Logger(EnhancedAiService_1.name);
    MAX_RECIPES_PER_DAY = 50;
    MAX_INGREDIENTS_PER_RECIPE = 15;
    BANNED_INGREDIENTS = [
        'methanol', 'ethanol (pure)', 'industrial alcohol', 'denatured alcohol',
        'toxic berries', 'poisonous plants', 'household chemicals', 'bleach',
        'ammonia', 'gasoline', 'paint thinner', 'antifreeze',
    ];
    BANNED_THEMES = [
        'drugs', 'illegal substances', 'explicit', 'offensive',
        'dangerous challenges', 'harmful', 'toxic', 'poison',
    ];
    constructor(aiRepository, quotaRepository, userRepository, ingredientRepository, cocktailRepository, hierarchicalIngredientService, externalService, llmAdapterService, configService) {
        this.aiRepository = aiRepository;
        this.quotaRepository = quotaRepository;
        this.userRepository = userRepository;
        this.ingredientRepository = ingredientRepository;
        this.cocktailRepository = cocktailRepository;
        this.hierarchicalIngredientService = hierarchicalIngredientService;
        this.externalService = externalService;
        this.llmAdapterService = llmAdapterService;
        this.configService = configService;
    }
    async generateRecipe(userId, request) {
        await this.checkUserQuota(userId);
        const sanitizedRequest = this.sanitizeAndValidateRequest(request);
        this.checkForBannedContent(sanitizedRequest);
        const validatedIngredients = await this.validateIngredients(sanitizedRequest.ingredients);
        const maxAttempts = sanitizedRequest.options?.maxAttempts || 3;
        let bestRecipe = null;
        let bestValidation = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                this.logger.log(`Attempt ${attempt}/${maxAttempts} for user ${userId}`);
                const aiProvider = this.getAiProvider();
                const rawRecipe = await aiProvider.generateRecipe(validatedIngredients.valid.map(ing => ing.name), {
                    theme: sanitizedRequest.theme,
                    difficulty: sanitizedRequest.difficulty,
                    language: sanitizedRequest.language || 'en',
                });
                const parsedRecipe = this.parseAiResponse(rawRecipe, sanitizedRequest);
                const validation = await this.validateGeneratedRecipe(parsedRecipe, validatedIngredients);
                if (!bestRecipe || validation.score > (bestValidation?.score || 0)) {
                    bestRecipe = parsedRecipe;
                    bestValidation = validation;
                }
                if (validation.score >= 0.8 && validation.isValid) {
                    this.logger.log(`Recipe validation passed on attempt ${attempt} with score ${validation.score}`);
                    break;
                }
                if (validation.issues.length > 0) {
                    this.logger.warn(`Validation issues on attempt ${attempt}:`, validation.issues);
                }
            }
            catch (error) {
                this.logger.error(`Attempt ${attempt} failed:`, error);
                if (attempt === maxAttempts) {
                    throw new common_1.InternalServerErrorException(`Failed to generate valid recipe after ${maxAttempts} attempts. ` +
                        `Last error: ${error.message}`);
                }
            }
        }
        if (!bestRecipe || !bestValidation) {
            throw new common_1.InternalServerErrorException('Failed to generate any valid recipe');
        }
        if (sanitizedRequest.options?.checkForDuplicates !== false) {
            const isDuplicate = await this.checkForDuplicateRecipe(bestRecipe);
            if (isDuplicate) {
                bestValidation.issues.push({
                    type: 'format',
                    severity: 'medium',
                    message: 'Generated recipe is very similar to existing recipes',
                    suggestion: 'Try different ingredients or theme',
                });
                bestValidation.score *= 0.8;
            }
        }
        if (sanitizedRequest.options?.includeSafetyWarnings !== false) {
            bestRecipe.metadata.safetyWarnings = this.generateSafetyWarnings(bestRecipe, bestValidation);
        }
        bestRecipe.metadata.validation = {
            isValid: bestValidation.isValid && bestValidation.score >= 0.7,
            issues: bestValidation.issues.map(issue => `${issue.severity}: ${issue.message}`),
            warnings: bestValidation.warnings,
        };
        bestRecipe.metadata.attempts = maxAttempts;
        await this.recordGeneration(userId, bestRecipe, bestValidation);
        await this.incrementUserQuota(userId);
        return bestRecipe;
    }
    async validateAndSaveRecipe(userId, aiRecipeId, options) {
        const aiRecord = await this.aiRepository.findOne({
            where: { id: aiRecipeId, user: { id: userId } },
        });
        if (!aiRecord) {
            throw new common_1.NotFoundException('AI recipe not found or access denied');
        }
        const recipeData = JSON.parse(aiRecord.recipe_data);
        const validation = await this.validateGeneratedRecipe(recipeData, {
            valid: recipeData.ingredients,
            invalid: [],
            suggestions: [],
        }, options?.validateStrictly);
        if (!validation.isValid && options?.validateStrictly) {
            throw new common_1.BadRequestException('Recipe validation failed: ' + validation.issues.map(i => i.message).join(', '));
        }
        const ingredientEntities = await this.mapIngredientsToEntities(recipeData.ingredients);
        const cocktail = this.cocktailRepository.create({
            name: recipeData.name,
            description: recipeData.description,
            instructions: recipeData.instructions.join('\n'),
            is_public: options?.makePublic || false,
            source: 'ai',
            user: { id: userId },
            ingredients: ingredientEntities.map((ingredient, index) => {
                const cocktailIngredient = new cocktail_ingredient_entity_1.CocktailIngredient();
                cocktailIngredient.ingredient = ingredient;
                cocktailIngredient.amount = recipeData.ingredients[index].amount;
                cocktailIngredient.unit = recipeData.ingredients[index].unit;
                cocktailIngredient.measure = recipeData.ingredients[index].note || '';
                return cocktailIngredient;
            }),
        });
        const savedCocktail = await this.cocktailRepository.save(cocktail);
        aiRecord.saved_as_cocktail_id = savedCocktail.id;
        await this.aiRepository.save(aiRecord);
        this.logger.log(`User ${userId} saved AI recipe as cocktail ${savedCocktail.id}`);
        return savedCocktail;
    }
    async getAiRecipeHistory(userId, pagination) {
        const [records, total] = await this.aiRepository.findAndCount({
            where: { user: { id: userId } },
            order: { created_at: 'DESC' },
            skip: pagination.offset,
            take: pagination.limit,
        });
        const data = records.map(record => ({
            id: record.id,
            name: JSON.parse(record.recipe_data).name,
            description: JSON.parse(record.recipe_data).description,
            validationScore: record.validation_score,
            isValid: record.is_valid,
            savedAsCocktailId: record.saved_as_cocktail_id,
            createdAt: record.created_at,
            attempts: record.attempts,
        }));
        return { data, total };
    }
    async getRecipeValidationReport(aiRecipeId, userId) {
        const aiRecord = await this.aiRepository.findOne({
            where: { id: aiRecipeId, user: { id: userId } },
        });
        if (!aiRecord) {
            throw new common_1.NotFoundException('AI recipe not found or access denied');
        }
        const recipeData = JSON.parse(aiRecord.recipe_data);
        const validation = await this.validateGeneratedRecipe(recipeData, {
            valid: recipeData.ingredients,
            invalid: [],
            suggestions: [],
        });
        return validation;
    }
    async checkUserQuota(userId) {
        const today = new Date().toISOString().split('T')[0];
        let quota = await this.quotaRepository.findOne({
            where: { user: { id: userId }, quotaDate: today },
        });
        if (!quota) {
            try {
                quota = this.quotaRepository.create({
                    user: { id: userId },
                    quotaDate: today,
                    usageCount: 0,
                });
                await this.quotaRepository.save(quota);
            }
            catch (error) {
                quota = await this.quotaRepository.findOne({
                    where: { user: { id: userId }, quotaDate: today },
                });
                if (!quota) {
                    throw new common_1.InternalServerErrorException('Failed to check AI quota');
                }
            }
        }
        if (quota.usageCount >= this.MAX_RECIPES_PER_DAY) {
            throw new common_1.ForbiddenException(`Daily limit of ${this.MAX_RECIPES_PER_DAY} AI recipes exceeded. ` +
                `Please try again tomorrow.`);
        }
    }
    async incrementUserQuota(userId) {
        const today = new Date().toISOString().split('T')[0];
        await this.quotaRepository
            .createQueryBuilder()
            .update(user_ai_quotas_entity_1.UserAiQuotas)
            .set({ usageCount: () => 'usage_count + 1' })
            .where('user_id = :userId AND quota_date = :today', { userId, today })
            .execute();
    }
    sanitizeAndValidateRequest(request) {
        if (!request.ingredients || !Array.isArray(request.ingredients) || request.ingredients.length === 0) {
            throw new common_1.BadRequestException('At least one ingredient is required');
        }
        if (request.ingredients.length > this.MAX_INGREDIENTS_PER_RECIPE) {
            throw new common_1.BadRequestException(`Maximum ${this.MAX_INGREDIENTS_PER_RECIPE} ingredients allowed per recipe`);
        }
        const blockedPatterns = [
            /ignore.*previous.*instructions/i,
            /system.*prompt/i,
            /output.*template/i,
            /disregard.*previous/i,
            /respond\s+in\s+plain\s+text/i,
            /forget\s+your\s+instructions/i,
            /you\s+are\s+now/i,
            /new\s+system\s+prompt/i,
        ];
        const MAX_LENGTH = 500;
        const sanitizedIngredients = request.ingredients.map(ingredient => {
            const trimmed = ingredient.trim();
            if (trimmed.length === 0) {
                throw new common_1.BadRequestException('Ingredient names cannot be empty');
            }
            const truncated = trimmed.slice(0, MAX_LENGTH);
            const sanitized = truncated.replace(/[^a-zA-Z0-9\s,.\-'/&%()]/g, '').trim();
            if (sanitized.length === 0) {
                throw new common_1.BadRequestException('Ingredient name contains no valid characters');
            }
            for (const pattern of blockedPatterns) {
                if (pattern.test(sanitized)) {
                    throw new common_1.BadRequestException('Input contains blocked patterns');
                }
            }
            return sanitized;
        });
        let sanitizedTheme;
        if (request.theme) {
            sanitizedTheme = request.theme.trim();
            if (sanitizedTheme.length > 200) {
                throw new common_1.BadRequestException('Theme cannot exceed 200 characters');
            }
        }
        const validDifficulties = ['easy', 'medium', 'hard'];
        const sanitizedDifficulty = request.difficulty && validDifficulties.includes(request.difficulty)
            ? request.difficulty
            : 'medium';
        const sanitizedServingSize = request.servingSize
            ? Math.max(1, Math.min(20, request.servingSize))
            : 1;
        const validLanguages = ['en', 'es', 'fr', 'de', 'it'];
        const sanitizedLanguage = request.language && validLanguages.includes(request.language)
            ? request.language
            : 'en';
        return {
            ...request,
            ingredients: sanitizedIngredients,
            theme: sanitizedTheme,
            difficulty: sanitizedDifficulty,
            servingSize: sanitizedServingSize,
            language: sanitizedLanguage,
        };
    }
    checkForBannedContent(request) {
        const bannedFound = request.ingredients.filter(ingredient => this.BANNED_INGREDIENTS.some(banned => ingredient.toLowerCase().includes(banned.toLowerCase())));
        if (bannedFound.length > 0) {
            throw new common_1.ForbiddenException(`Banned ingredients detected: ${bannedFound.join(', ')}. ` +
                `Please use safe, food-grade ingredients only.`);
        }
        if (request.theme) {
            const isBannedTheme = this.BANNED_THEMES.some(banned => request.theme.toLowerCase().includes(banned.toLowerCase()));
            if (isBannedTheme) {
                throw new common_1.ForbiddenException('Requested theme contains inappropriate content. ' +
                    'Please choose a different theme.');
            }
        }
    }
    async validateIngredients(ingredients) {
        const valid = [];
        const invalid = [];
        const suggestions = [];
        for (const ingredient of ingredients) {
            try {
                const match = await this.hierarchicalIngredientService.findBestMatch(ingredient, {
                    includeHierarchical: true,
                    includeSynonyms: true,
                    minConfidence: 0.6,
                });
                if (match) {
                    valid.push({ name: ingredient, match });
                    if (match.matchType !== 'exact') {
                        suggestions.push({
                            original: ingredient,
                            suggestion: `Using "${match.ingredient.name}" (${match.matchType} match, confidence: ${match.confidence.toFixed(2)})`,
                        });
                    }
                }
                else {
                    const externalCheck = await this.externalService.searchByIngredient(ingredient);
                    if (externalCheck && externalCheck.length > 0) {
                        valid.push({ name: ingredient });
                    }
                    else {
                        invalid.push(ingredient);
                        suggestions.push({
                            original: ingredient,
                            suggestion: 'Ingredient not recognized. Please check spelling or use a common alternative.',
                        });
                    }
                }
            }
            catch (error) {
                this.logger.warn(`Failed to validate ingredient "${ingredient}":`, error);
                valid.push({ name: ingredient });
            }
        }
        return { valid, invalid, suggestions };
    }
    getAiProvider() {
        return this.llmAdapterService;
    }
    parseAiResponse(rawResponse, request) {
        const defaultRecipe = {
            id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `AI Generated ${request.theme ? request.theme + ' ' : ''}Cocktail`,
            description: 'An AI-generated cocktail recipe',
            instructions: ['Mix all ingredients together', 'Serve chilled'],
            ingredients: request.ingredients.map((ing, index) => ({
                name: ing,
                amount: 1 + (index * 0.5),
                unit: index % 2 === 0 ? 'oz' : 'ml',
                note: 'Adjust to taste',
            })),
            metadata: {
                difficulty: request.difficulty || 'medium',
                preparationTime: '5 minutes',
                servingSize: request.servingSize || 1,
                theme: request.theme,
                safetyWarnings: [],
                validation: {
                    isValid: false,
                    issues: [],
                    warnings: [],
                },
                source: 'ai-generated',
                generatedAt: new Date().toISOString(),
                attempts: 1,
            },
        };
        if (typeof rawResponse === 'string') {
            try {
                const parsed = JSON.parse(rawResponse);
                if (parsed.name)
                    defaultRecipe.name = parsed.name;
                if (parsed.description)
                    defaultRecipe.description = parsed.description;
                if (parsed.instructions)
                    defaultRecipe.instructions = Array.isArray(parsed.instructions)
                        ? parsed.instructions
                        : [parsed.instructions];
                if (parsed.ingredients)
                    defaultRecipe.ingredients = parsed.ingredients;
            }
            catch (error) {
                defaultRecipe.description = rawResponse.substring(0, 200) + '...';
            }
        }
        else if (rawResponse && typeof rawResponse === 'object') {
            Object.assign(defaultRecipe, rawResponse);
        }
        return defaultRecipe;
    }
    async validateGeneratedRecipe(recipe, ingredientValidation, strict = false) {
        const issues = [];
        const warnings = [];
        const suggestions = [];
        let score = 1.0;
        if (!recipe.name || recipe.name.trim().length === 0) {
            issues.push({
                type: 'format',
                severity: 'high',
                message: 'Recipe name is missing',
                suggestion: 'Add a descriptive name for the cocktail',
            });
            score -= 0.2;
        }
        if (!recipe.instructions || recipe.instructions.length === 0) {
            issues.push({
                type: 'instruction',
                severity: 'high',
                message: 'No instructions provided',
                suggestion: 'Add step-by-step preparation instructions',
            });
            score -= 0.3;
        }
        if (!recipe.ingredients || recipe.ingredients.length === 0) {
            issues.push({
                type: 'ingredient',
                severity: 'critical',
                message: 'No ingredients specified',
                suggestion: 'Add at least one ingredient',
            });
            score -= 0.5;
        }
        for (const ingredient of recipe.ingredients) {
            if (ingredient.amount <= 0) {
                issues.push({
                    type: 'ingredient',
                    severity: 'medium',
                    message: `Invalid amount for ${ingredient.name}: ${ingredient.amount}`,
                    suggestion: 'Use positive amounts for ingredients',
                });
                score -= 0.05;
            }
            if (!ingredient.unit || ingredient.unit.trim().length === 0) {
                issues.push({
                    type: 'ingredient',
                    severity: 'low',
                    message: `Missing unit for ${ingredient.name}`,
                    suggestion: 'Specify a unit (ml, oz, dash, etc.)',
                });
                score -= 0.02;
            }
            if (ingredient.unit === 'ml' && ingredient.amount > 1000) {
                warnings.push(`Large amount of ${ingredient.name}: ${ingredient.amount}ml`);
                score -= 0.01;
            }
            if (ingredient.unit === 'oz' && ingredient.amount > 32) {
                warnings.push(`Large amount of ${ingredient.name}: ${ingredient.amount}oz`);
                score -= 0.01;
            }
        }
        const safetyIssues = this.checkForSafetyIssues(recipe);
        issues.push(...safetyIssues);
        score -= safetyIssues.length * 0.1;
        if (ingredientValidation.invalid.length > 0) {
            issues.push({
                type: 'ingredient',
                severity: 'medium',
                message: `Unrecognized ingredients: ${ingredientValidation.invalid.join(', ')}`,
                suggestion: 'Use common, recognized ingredient names',
            });
            score -= ingredientValidation.invalid.length * 0.05;
        }
        if (recipe.instructions.length < 2) {
            warnings.push('Recipe instructions are very brief');
            score -= 0.05;
        }
        if (recipe.ingredients.length < 2) {
            warnings.push('Recipe has very few ingredients');
            score -= 0.05;
        }
        if (strict && score < 0.9) {
            issues.push({
                type: 'format',
                severity: 'medium',
                message: 'Recipe does not meet strict validation standards',
                suggestion: 'Improve recipe completeness and accuracy',
            });
        }
        score = Math.max(0, Math.min(1, score));
        return {
            isValid: issues.filter(i => i.severity === 'critical').length === 0 && score >= 0.7,
            score,
            issues,
            warnings,
            suggestions: [...suggestions, ...ingredientValidation.suggestions.map(s => s.suggestion)],
        };
    }
    checkForSafetyIssues(recipe) {
        const issues = [];
        const alcoholKeywords = ['everclear', 'grain alcohol', 'pure ethanol', 'moonshine'];
        for (const ingredient of recipe.ingredients) {
            if (alcoholKeywords.some(keyword => ingredient.name.toLowerCase().includes(keyword))) {
                issues.push({
                    type: 'safety',
                    severity: 'high',
                    message: `High-proof alcohol detected: ${ingredient.name}`,
                    suggestion: 'Use standard proof spirits instead',
                });
            }
        }
        const hasMultipleHighProof = recipe.ingredients.filter(ing => alcoholKeywords.some(keyword => ing.name.toLowerCase().includes(keyword))).length > 1;
        if (hasMultipleHighProof) {
            issues.push({
                type: 'safety',
                severity: 'critical',
                message: 'Multiple high-proof alcohols detected - dangerous combination',
                suggestion: 'Limit to one high-proof spirit per recipe',
            });
        }
        const nonFoodKeywords = ['cleaner', 'solvent', 'chemical', 'fuel', 'antifreeze'];
        for (const ingredient of recipe.ingredients) {
            if (nonFoodKeywords.some(keyword => ingredient.name.toLowerCase().includes(keyword))) {
                issues.push({
                    type: 'safety',
                    severity: 'critical',
                    message: `Non-food item detected: ${ingredient.name}`,
                    suggestion: 'Remove non-food ingredients',
                });
            }
        }
        return issues;
    }
    async checkForDuplicateRecipe(recipe) {
        const ingredientNames = recipe.ingredients.map(ing => ing.name.toLowerCase()).sort();
        const similarRecipes = await this.cocktailRepository
            .createQueryBuilder('cocktail')
            .innerJoin('cocktail.ingredients', 'ingredient')
            .where('cocktail.source = :source', { source: 'ai' })
            .getMany();
        for (const similarRecipe of similarRecipes) {
            const similarIngredientNames = similarRecipe.ingredients
                .map(ing => ing.ingredient.name.toLowerCase())
                .sort();
            const intersection = ingredientNames.filter(name => similarIngredientNames.includes(name));
            const similarity = intersection.length / Math.max(ingredientNames.length, similarIngredientNames.length);
            if (similarity > 0.8) {
                return true;
            }
        }
        return false;
    }
    generateSafetyWarnings(recipe, validation) {
        const warnings = [];
        warnings.push('Drink responsibly. Do not drink and drive.');
        warnings.push('This is an AI-generated recipe. Use caution and common sense.');
        const highAlcoholIngredients = recipe.ingredients.filter(ing => ['everclear', 'grain alcohol', 'pure ethanol'].some(keyword => ing.name.toLowerCase().includes(keyword)));
        if (highAlcoholIngredients.length > 0) {
            warnings.push('High-proof alcohols can be dangerous. Handle with care.');
        }
        if (validation.issues.some(issue => issue.type === 'safety')) {
            warnings.push('This recipe has safety concerns. Review carefully before making.');
        }
        if (validation.score < 0.8) {
            warnings.push('This recipe has validation issues. Consider modifying before use.');
        }
        return warnings;
    }
    async recordGeneration(userId, recipe, validation) {
        const aiRecord = this.aiRepository.create({
            user: { id: userId },
            prompt: JSON.stringify({
                ingredients: recipe.ingredients.map(ing => ing.name),
                theme: recipe.metadata.theme,
                difficulty: recipe.metadata.difficulty,
            }),
            recipe_data: JSON.stringify(recipe),
            validation_score: validation.score,
            is_valid: validation.isValid,
            attempts: recipe.metadata.attempts,
        });
        await this.aiRepository.save(aiRecord);
    }
    async mapIngredientsToEntities(ingredients) {
        const entities = [];
        for (const ingredient of ingredients) {
            let entity = await this.ingredientRepository.findOne({
                where: { name: ingredient.name.toLowerCase() },
            });
            if (!entity) {
                entity = this.ingredientRepository.create({
                    name: ingredient.name.toLowerCase(),
                    baseUnit: this.determineBaseUnit(ingredient.unit),
                    createdBy: 'ai-generated',
                });
                entity = await this.ingredientRepository.save(entity);
            }
            entities.push(entity);
        }
        return entities;
    }
    determineBaseUnit(unit) {
        const unitMap = {
            'ml': 'ml',
            'oz': 'ml',
            'cl': 'ml',
            'l': 'ml',
            'dash': 'dashes',
            'drop': 'drops',
            'splash': 'splashes',
            'part': 'parts',
            'slice': 'slices',
            'wedge': 'wedges',
            'twist': 'twists',
            'sprig': 'sprigs',
            'leaf': 'leaves',
        };
        return unitMap[unit.toLowerCase()] || 'count';
    }
};
exports.EnhancedAiService = EnhancedAiService;
exports.EnhancedAiService = EnhancedAiService = EnhancedAiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ai_entity_1.Ai)),
    __param(1, (0, typeorm_1.InjectRepository)(user_ai_quotas_entity_1.UserAiQuotas)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(ingredient_entity_1.Ingredient)),
    __param(4, (0, typeorm_1.InjectRepository)(cocktail_entity_1.Cocktail)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        hierarchical_ingredient_service_1.HierarchicalIngredientService,
        enhanced_cocktail_db_service_1.EnhancedTheCocktailDbService,
        llm_adapter_service_1.LlmAdapterService,
        config_1.ConfigService])
], EnhancedAiService);
//# sourceMappingURL=enhanced-ai.service.js.map