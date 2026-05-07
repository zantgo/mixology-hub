import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Ai } from './entities/ai.entity';
import { UserAiQuotas } from './entities/user-ai-quotas.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';
import { EnhancedTheCocktailDbService } from '../external/the-cocktail-db/enhanced-cocktail-db.service';
import { LlmAdapterService } from '../external/llm/llm-adapter.service';
export interface AiRecipeRequest {
    ingredients: string[];
    theme?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    servingSize?: number;
    language?: string;
    options?: {
        validateIngredients?: boolean;
        checkForDuplicates?: boolean;
        includeSafetyWarnings?: boolean;
        maxAttempts?: number;
    };
}
export interface AiRecipeResponse {
    id: string;
    name: string;
    description: string;
    instructions: string[];
    ingredients: Array<{
        name: string;
        amount: number;
        unit: string;
        note?: string;
    }>;
    metadata: {
        difficulty: string;
        preparationTime: string;
        servingSize: number;
        theme?: string;
        safetyWarnings: string[];
        validation: {
            isValid: boolean;
            issues: string[];
            warnings: string[];
        };
        source: 'ai-generated';
        generatedAt: string;
        model?: string;
        attempts: number;
    };
}
export interface AiRecipeValidationResult {
    isValid: boolean;
    score: number;
    issues: Array<{
        type: 'safety' | 'ingredient' | 'instruction' | 'format';
        severity: 'low' | 'medium' | 'high' | 'critical';
        message: string;
        suggestion?: string;
    }>;
    warnings: string[];
    suggestions: string[];
}
export declare class EnhancedAiService {
    private readonly aiRepository;
    private readonly quotaRepository;
    private readonly userRepository;
    private readonly ingredientRepository;
    private readonly cocktailRepository;
    private readonly hierarchicalIngredientService;
    private readonly externalService;
    private readonly llmAdapterService;
    private readonly configService;
    private readonly logger;
    private readonly MAX_RECIPES_PER_DAY;
    private readonly MAX_INGREDIENTS_PER_RECIPE;
    private readonly BANNED_INGREDIENTS;
    private readonly BANNED_THEMES;
    constructor(aiRepository: Repository<Ai>, quotaRepository: Repository<UserAiQuotas>, userRepository: Repository<User>, ingredientRepository: Repository<Ingredient>, cocktailRepository: Repository<Cocktail>, hierarchicalIngredientService: HierarchicalIngredientService, externalService: EnhancedTheCocktailDbService, llmAdapterService: LlmAdapterService, configService: ConfigService);
    generateRecipe(userId: string, request: AiRecipeRequest): Promise<AiRecipeResponse>;
    validateAndSaveRecipe(userId: string, aiRecipeId: string, options?: {
        makePublic?: boolean;
        validateStrictly?: boolean;
    }): Promise<Cocktail>;
    getAiRecipeHistory(userId: string, pagination: {
        limit: number;
        offset: number;
    }): Promise<{
        data: any[];
        total: number;
    }>;
    getRecipeValidationReport(aiRecipeId: string, userId: string): Promise<AiRecipeValidationResult>;
    private checkUserQuota;
    private incrementUserQuota;
    private sanitizeAndValidateRequest;
    private checkForBannedContent;
    private validateIngredients;
    private getAiProvider;
    private parseAiResponse;
    private validateGeneratedRecipe;
    private checkForSafetyIssues;
    private checkForDuplicateRecipe;
    private generateSafetyWarnings;
    private recordGeneration;
    private mapIngredientsToEntities;
    private determineBaseUnit;
}
