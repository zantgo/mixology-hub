import {
  sanitizePromptString,
  validatePromptSafety,
} from '../common/utils/prompt-security.util';
import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Decimal } from 'decimal.js';
import { ConfigService } from '@nestjs/config';
import { AiGeneratedRecipe } from './entities/ai.entity';
import { UserAiQuota } from './entities/user-ai-quota.entity';
import { User } from '../users/entities/user.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';
import { CocktailDbService } from '../external/the-cocktail-db/cocktail-db.service';
import { LlmAdapterService } from '../external/llm/llm-adapter.service';
import { BarInventoryService } from '../inventory/bar-inventory.service';
import { CocktailAggregatorService } from '../cocktails/cocktail-aggregator.service';
import { UnitConverterService } from '../utils/unit-converter.service';
import { UpdateAiDto } from './dto/update-ai.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { sanitizeHtml } from '../common/utils/xss-sanitizer.util';

export interface AiRecipeRequest {
  ingredients: string[];
  theme?: string;
  modifiers?: string[];
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

interface ParsedRecipeData {
  name?: string;
  description?: string;
  instructions?: string | string[];
  ingredients?: Array<{
    name: string;
    amount: number;
    unit: string;
    note?: string;
  }>;
  metadata?: {
    theme?: string;
    difficulty?: string;
    preparationTime?: string;
    servingSize?: number;
    language?: string;
  };
}

interface RecipeToolArgs {
  limit?: number;
  name?: string;
  cocktailId?: string;
  quantity?: number;
  fromUnit?: string;
  toUnit?: string;
}

interface IngredientValidationResult {
  valid: Array<{ name: string; match?: unknown }>;
  invalid: string[];
  suggestions: Array<{ original: string; suggestion: string }>;
}

interface ToolInventoryItem {
  ingredient?: { name?: string; baseUnit?: string };
  quantity?: { toString(): string };
  unit?: string;
}

interface ToolSearchCocktailItem {
  id: string;
  name: string;
  source: string;
  ingredients?: Array<unknown>;
}

export interface AiHistoryEntry {
  id: string;
  name: string;
  description: string;
  validationScore: number;
  isValid: boolean;
  savedAsCocktailId: string | null;
  createdAt: Date;
  attempts: number;
}

@Injectable()
export class AiRecipeService {
  private readonly logger = new Logger(AiRecipeService.name);
  private readonly MAX_RECIPES_PER_DAY: number;
  private readonly MAX_INGREDIENTS_PER_RECIPE: number;
  private readonly BANNED_INGREDIENTS: string[];
  private readonly BANNED_THEMES: string[];

  private readonly recipeTools = this.buildRecipeTools();

  constructor(
    @InjectRepository(AiGeneratedRecipe)
    private readonly aiRepository: Repository<AiGeneratedRecipe>,
    @InjectRepository(UserAiQuota)
    private readonly quotaRepository: Repository<UserAiQuota>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(Cocktail)
    private readonly cocktailRepository: Repository<Cocktail>,
    @InjectRepository(UserProfile)
    private readonly userProfileRepository: Repository<UserProfile>,
    private readonly hierarchicalIngredientService: HierarchicalIngredientService,
    private readonly cocktailDbService: CocktailDbService,
    private readonly llmAdapterService: LlmAdapterService,
    private readonly barInventoryService: BarInventoryService,
    private readonly aggregatorService: CocktailAggregatorService,
    private readonly unitConverter: UnitConverterService,
    private readonly configService: ConfigService,
  ) {
    this.MAX_RECIPES_PER_DAY =
      this.configService.get<number>('AI_MAX_RECIPES_PER_DAY') || 50;
    this.MAX_INGREDIENTS_PER_RECIPE =
      this.configService.get<number>('AI_MAX_INGREDIENTS_PER_RECIPE') || 15;
    this.BANNED_INGREDIENTS = this.configService
      .get<string>('AI_BANNED_INGREDIENTS')
      ?.split(',')
      .map((s) => s.trim().toLowerCase()) || [
      'methanol',
      'ethanol (pure)',
      'industrial alcohol',
      'denatured alcohol',
      'toxic berries',
      'poisonous plants',
      'household chemicals',
      'bleach',
      'ammonia',
      'gasoline',
      'paint thinner',
      'antifreeze',
    ];
    this.BANNED_THEMES = this.configService
      .get<string>('AI_BANNED_THEMES')
      ?.split(',')
      .map((s) => s.trim().toLowerCase()) || [
      'drugs',
      'illegal substances',
      'explicit',
      'offensive',
      'dangerous challenges',
      'harmful',
      'toxic',
      'poison',
    ];
  }

  async generateRecipe(
    userId: string,
    request: AiRecipeRequest,
  ): Promise<AiRecipeResponse> {
    // 1. Validate and sanitize inputs (cheap, do before consuming quota)
    const sanitizedRequest = this.sanitizeAndValidateRequest(request);

    // 2. Check current quota (read-only, actual consumption deferred until after generation succeeds)
    await this.checkUserQuota(userId);

    // 3. Check for banned content
    this.checkForBannedContent(sanitizedRequest);

    // 4. Validate ingredients against database
    const validatedIngredients = await this.validateIngredients(
      sanitizedRequest.ingredients,
    );

    // 5. Generate recipe with multiple attempts using MCP tool calling (ADR 0019)
    const maxAttempts = sanitizedRequest.options?.maxAttempts || 3;
    let bestRecipe: AiRecipeResponse | null = null;
    let bestValidation: AiRecipeValidationResult | null = null;

    const sanitizedIngredientNames = validatedIngredients.valid.map(
      (ing) => ing.name,
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.log(`Attempt ${attempt}/${maxAttempts} for user ${userId}`);

        const profile = await this.userProfileRepository.findOne({
          where: { user: { id: userId } },
        });

        const rawRecipe = await this.llmAdapterService.generateWithTools(
          sanitizedIngredientNames,
          this.recipeTools,
          (toolName: string, args: any) =>
            this.executeRecipeTool(toolName, args as RecipeToolArgs),
          {
            theme: sanitizedRequest.theme,
            modifiers: sanitizedRequest.modifiers,
            difficulty: sanitizedRequest.difficulty,
            language: sanitizedRequest.language || 'en',
            unitSystem:
              (profile?.unitSystem as 'metric' | 'imperial') || 'metric',
          },
        );

        const parsedRecipe = this.buildRecipeFromParsed(
          rawRecipe,
          sanitizedRequest,
        );
        const validation = this.validateGeneratedRecipe(
          parsedRecipe,
          validatedIngredients,
        );

        if (!bestRecipe || validation.score > (bestValidation?.score || 0)) {
          bestRecipe = parsedRecipe;
          bestValidation = validation;
        }

        if (validation.score >= 0.8 && validation.isValid) {
          this.logger.log(
            `Recipe validation passed on attempt ${attempt} with score ${validation.score}`,
          );
          break;
        }

        if (validation.issues.length > 0) {
          this.logger.warn(
            `Validation issues on attempt ${attempt}:`,
            validation.issues,
          );
        }
      } catch (error: unknown) {
        this.logger.error(`Attempt ${attempt} failed:`, error);

        if (attempt === maxAttempts) {
          const message =
            error instanceof Error ? error.message : String(error);
          throw new InternalServerErrorException(
            `Failed to generate valid recipe after ${maxAttempts} attempts. ` +
              `Last error: ${message}`,
          );
        }
      }
    }

    if (!bestRecipe || !bestValidation) {
      throw new InternalServerErrorException(
        'Failed to generate any valid recipe',
      );
    }

    // Atomically consume quota now that generation succeeded
    await this.consumeUserQuota(userId);

    // 12. Check for duplicate recipes
    if (sanitizedRequest.options?.checkForDuplicates !== false) {
      const isDuplicate = await this.checkForDuplicateRecipe(bestRecipe);
      if (isDuplicate) {
        bestValidation.issues.push({
          type: 'format',
          severity: 'medium',
          message: 'Generated recipe is very similar to existing recipes',
          suggestion: 'Try different ingredients or theme',
        });
        bestValidation.score *= 0.8; // Penalize duplicate recipes
      }
    }

    // 13. Add safety warnings if enabled
    if (sanitizedRequest.options?.includeSafetyWarnings !== false) {
      bestRecipe.metadata.safetyWarnings = this.generateSafetyWarnings(
        bestRecipe,
        bestValidation,
      );
    }

    // 14. Update validation metadata
    bestRecipe.metadata.validation = {
      isValid: bestValidation.isValid && bestValidation.score >= 0.7,
      issues: bestValidation.issues.map(
        (issue) => `${issue.severity}: ${issue.message}`,
      ),
      warnings: bestValidation.warnings,
    };
    bestRecipe.metadata.attempts = maxAttempts;

    // 15. Store generation record (without saving the recipe itself)
    await this.recordGeneration(userId, bestRecipe, bestValidation);

    return bestRecipe;
  }

  async regenerateRecipe(
    userId: string,
    aiRecipeId: string,
  ): Promise<AiRecipeResponse> {
    const original = await this.aiRepository.findOne({
      where: { id: aiRecipeId, user: { id: userId } },
    });
    if (!original) {
      throw new NotFoundException('AI recipe not found or access denied');
    }

    let recipeData: ParsedRecipeData;
    try {
      const rawRecipeJson: string = (original.recipeData as string) || '{}';
      recipeData = JSON.parse(rawRecipeJson) as ParsedRecipeData;
    } catch {
      throw new BadRequestException('Original recipe data is corrupt');
    }

    const ingredientNames = (recipeData.ingredients || []).map((i) => i.name);

    if (ingredientNames.length === 0) {
      throw new BadRequestException('No ingredients found in original recipe');
    }

    return this.generateRecipe(userId, {
      ingredients: ingredientNames,
      theme: recipeData.metadata?.theme,
      modifiers: ['different variation'],
      difficulty: recipeData.metadata
        ?.difficulty as AiRecipeRequest['difficulty'],
      servingSize: recipeData.metadata?.servingSize,
      language: recipeData.metadata?.language,
    });
  }

  async validateAndSaveRecipe(
    userId: string,
    aiRecipeId: string,
    options?: { makePublic?: boolean; validateStrictly?: boolean },
  ): Promise<Cocktail> {
    // 1. Retrieve the AI-generated recipe
    const aiRecord = await this.aiRepository.findOne({
      where: { id: aiRecipeId, user: { id: userId } },
    });

    if (!aiRecord) {
      throw new NotFoundException('AI recipe not found or access denied');
    }

    // 2. Parse the stored recipe
    const recipeJson: string = aiRecord.recipeData as string;
    const recipeData = JSON.parse(recipeJson) as ParsedRecipeData;

    // 3. Re-validate with strict rules if requested
    const validation = this.validateGeneratedRecipe(
      recipeData as unknown as AiRecipeResponse,
      {
        valid: recipeData.ingredients || [],
        invalid: [],
        suggestions: [],
      },
      options?.validateStrictly,
    );

    if (!validation.isValid && options?.validateStrictly) {
      throw new BadRequestException(
        'Recipe validation failed: ' +
          validation.issues.map((i) => i.message).join(', '),
      );
    }

    // 4. Map ingredients to database entities (passing userId)
    const ingredientEntities = await this.mapIngredientsToEntities(
      recipeData.ingredients || [],
      userId,
    );

    // 5. Create cocktail entity
    const ingredients = recipeData.ingredients || [];
    const cocktail = this.cocktailRepository.create({
      name: recipeData.name,
      description: recipeData.description,
      instructions: Array.isArray(recipeData.instructions)
        ? recipeData.instructions.join('\n')
        : recipeData.instructions || '',
      isPublic: options?.makePublic || false,
      source: 'ai',
      user: { id: userId },
      ingredients: ingredientEntities.map((ingredient, index) => {
        const cocktailIngredient = new CocktailIngredient();
        cocktailIngredient.ingredient = ingredient;
        cocktailIngredient.amount = new Decimal(ingredients[index].amount);
        cocktailIngredient.unit = ingredients[index].unit;
        cocktailIngredient.measure = ingredients[index].note || '';
        return cocktailIngredient;
      }),
    });

    // 6. Save to database
    const savedCocktail = await this.cocktailRepository.save(cocktail);

    // 7. Update AI record to mark as saved
    aiRecord.savedAsCocktailId = savedCocktail.id;
    await this.aiRepository.save(aiRecord);

    this.logger.log(
      `User ${userId} saved AI recipe as cocktail ${savedCocktail.id}`,
    );

    return savedCocktail;
  }

  async getAiRecipeHistory(
    userId: string,
    pagination: PaginationQueryDto,
  ): Promise<{
    data: AiHistoryEntry[];
    meta: {
      currentPage: number;
      nextPage: number | null;
      itemsPerPage: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    const { limit = 10, page = 1 } = pagination;
    const offset = (page - 1) * limit;
    const [records, total] = await this.aiRepository.findAndCount({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    const data: AiHistoryEntry[] = records.map((record) => {
      const recipeJson: string = record.recipeData as string;
      const parsed = JSON.parse(recipeJson) as ParsedRecipeData;
      return {
        id: record.id,
        name: parsed.name || '',
        description: parsed.description || '',
        validationScore: record.validationScore,
        isValid: record.isValid,
        savedAsCocktailId: record.savedAsCocktailId,
        createdAt: record.createdAt,
        attempts: record.attempts,
      };
    });

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;

    return {
      data,
      meta: {
        currentPage: page,
        nextPage: hasNextPage ? page + 1 : null,
        itemsPerPage: limit,
        totalItems: total,
        totalPages,
      },
    };
  }

  async getQuotaStatus(userId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const quota = await this.quotaRepository.findOne({
      where: { user: { id: userId }, quotaDate: today },
    });
    return {
      used: quota?.usageCount || 0,
      limit: this.MAX_RECIPES_PER_DAY,
      remaining: Math.max(
        0,
        this.MAX_RECIPES_PER_DAY - (quota?.usageCount || 0),
      ),
    };
  }

  async getRecipeValidationReport(
    aiRecipeId: string,
    userId: string,
  ): Promise<AiRecipeValidationResult> {
    const aiRecord = await this.aiRepository.findOne({
      where: { id: aiRecipeId, user: { id: userId } },
    });

    if (!aiRecord) {
      throw new NotFoundException('AI recipe not found or access denied');
    }

    const recipeJson: string = aiRecord.recipeData as string;
    const recipeData = JSON.parse(recipeJson) as ParsedRecipeData;
    const validation = this.validateGeneratedRecipe(
      recipeData as unknown as AiRecipeResponse,
      {
        valid: recipeData.ingredients || [],
        invalid: [],
        suggestions: [],
      },
    );

    return validation;
  }

  private async checkUserQuota(userId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const quota = await this.quotaRepository.findOne({
      where: { user: { id: userId }, quotaDate: today },
    });
    if ((quota?.usageCount || 0) >= this.MAX_RECIPES_PER_DAY) {
      throw new ForbiddenException(
        `Daily limit of ${this.MAX_RECIPES_PER_DAY} AI recipes exceeded. ` +
          `Please try again tomorrow.`,
      );
    }
  }

  private async consumeUserQuota(userId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const rawResult: unknown = await this.quotaRepository.manager.query(
      `INSERT INTO user_ai_quotas (user_id, quota_date, usage_count, last_updated_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (user_id, quota_date)
       DO UPDATE SET usage_count = user_ai_quotas.usage_count + 1,
                     last_updated_at = NOW()
       RETURNING usage_count`,
      [userId, today],
    );
    const rows = rawResult as Array<{ usage_count: number }>;
    const newCount: number = rows[0]?.usage_count ?? 1;
    if (newCount > this.MAX_RECIPES_PER_DAY) {
      throw new ForbiddenException(
        `Daily limit of ${this.MAX_RECIPES_PER_DAY} AI recipes exceeded. ` +
          `Please try again tomorrow.`,
      );
    }
  }

  private sanitizeAndValidateRequest(
    request: AiRecipeRequest,
  ): AiRecipeRequest {
    if (
      !request.ingredients ||
      !Array.isArray(request.ingredients) ||
      request.ingredients.length === 0
    ) {
      throw new BadRequestException('At least one ingredient is required');
    }

    if (request.ingredients.length > this.MAX_INGREDIENTS_PER_RECIPE) {
      throw new BadRequestException(
        `Maximum ${this.MAX_INGREDIENTS_PER_RECIPE} ingredients allowed per recipe`,
      );
    }

    const isStrictInventoryMode = request.ingredients.length > 5;
    const maxLength = isStrictInventoryMode ? 2000 : 500;

    const sanitizedIngredients = request.ingredients.map((ingredient) => {
      const trimmed = ingredient.trim();
      if (trimmed.length === 0) {
        throw new BadRequestException('Ingredient names cannot be empty');
      }
      const sanitized = sanitizePromptString(trimmed, maxLength);
      if (sanitized.length === 0) {
        throw new BadRequestException(
          'Ingredient name contains no valid characters',
        );
      }
      validatePromptSafety(sanitized);
      return sanitized;
    });

    let sanitizedTheme: string | undefined;
    if (request.theme) {
      const trimmed = request.theme.trim();
      if (trimmed.length > 200) {
        throw new BadRequestException('Theme cannot exceed 200 characters');
      }
      const sanitized = sanitizePromptString(trimmed, 200);
      if (sanitized.length === 0) {
        throw new BadRequestException('Theme contains no valid characters');
      }
      validatePromptSafety(sanitized);
      sanitizedTheme = sanitized;
    }

    // Validate difficulty
    const validDifficulties = ['easy', 'medium', 'hard'];
    const sanitizedDifficulty =
      request.difficulty && validDifficulties.includes(request.difficulty)
        ? request.difficulty
        : 'medium';

    // Validate serving size
    const sanitizedServingSize = request.servingSize
      ? Math.max(1, Math.min(20, request.servingSize))
      : 1;

    // Validate language
    const validLanguages = ['en', 'es', 'fr', 'de', 'it'];
    const sanitizedLanguage =
      request.language && validLanguages.includes(request.language)
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

  private checkForBannedContent(request: AiRecipeRequest): void {
    // Check banned ingredients
    const bannedFound = request.ingredients.filter((ingredient) =>
      this.BANNED_INGREDIENTS.some((banned) =>
        ingredient.toLowerCase().includes(banned.toLowerCase()),
      ),
    );

    if (bannedFound.length > 0) {
      throw new ForbiddenException(
        `Banned ingredients detected: ${bannedFound.join(', ')}. ` +
          `Please use safe, food-grade ingredients only.`,
      );
    }

    // Check banned themes
    if (request.theme) {
      const isBannedTheme = this.BANNED_THEMES.some((banned) =>
        request.theme!.toLowerCase().includes(banned.toLowerCase()),
      );

      if (isBannedTheme) {
        throw new ForbiddenException(
          'Requested theme contains inappropriate content. ' +
            'Please choose a different theme.',
        );
      }
    }
  }

  private async validateIngredients(ingredients: string[]): Promise<{
    valid: Array<{ name: string; match?: any }>;
    invalid: string[];
    suggestions: Array<{ original: string; suggestion: string }>;
  }> {
    const valid: Array<{ name: string; match?: any }> = [];
    const invalid: string[] = [];
    const suggestions: Array<{ original: string; suggestion: string }> = [];

    for (const ingredient of ingredients) {
      try {
        // Try to find a match in our ingredient database
        const match = await this.hierarchicalIngredientService.findBestMatch(
          ingredient,
          {
            includeHierarchical: true,
            includeSynonyms: true,
            minConfidence: 0.6,
          },
        );

        if (match) {
          valid.push({ name: ingredient, match });

          // If it's not an exact match, provide suggestion
          if (match.matchType !== 'exact') {
            suggestions.push({
              original: ingredient,
              suggestion: `Using "${match.ingredient.name}" (${match.matchType} match, confidence: ${match.confidence.toFixed(2)})`,
            });
          }
        } else {
          // Check if it exists in external API
          const externalCheck =
            (await this.cocktailDbService.searchByIngredient(
              ingredient,
            )) as Array<unknown> | null;
          if (externalCheck && externalCheck.length > 0) {
            valid.push({ name: ingredient });
          } else {
            invalid.push(ingredient);
            suggestions.push({
              original: ingredient,
              suggestion:
                'Ingredient not recognized. Please check spelling or use a common alternative.',
            });
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to validate ingredient "${ingredient}":`,
          error,
        );
        valid.push({ name: ingredient }); // Allow unknown ingredients with warning
      }
    }

    return { valid, invalid, suggestions };
  }

  private buildRecipeTools(): Array<{
    type: 'function';
    function: { name: string; description: string; parameters: any };
  }> {
    return [
      {
        type: 'function',
        function: {
          name: 'get_bar_inventory',
          description:
            'Retrieve current bar inventory stock levels and quantities',
          parameters: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Max items to return (default 50)',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_cocktails',
          description:
            'Search for existing cocktails by name across local and external databases',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Search query' },
              limit: {
                type: 'number',
                description: 'Max results (default 10)',
              },
            },
            required: ['name'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_cocktail_detail',
          description:
            'Get full recipe details including ingredients and instructions for a cocktail',
          parameters: {
            type: 'object',
            properties: {
              cocktailId: { type: 'string', description: 'Cocktail ID' },
            },
            required: ['cocktailId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'convert_units',
          description:
            'Convert between measurement units (ml, oz, cl, tbsp, tsp, etc.)',
          parameters: {
            type: 'object',
            properties: {
              quantity: { type: 'number', description: 'Amount to convert' },
              fromUnit: { type: 'string', description: 'Source unit' },
              toUnit: { type: 'string', description: 'Target unit' },
              ingredient: {
                type: 'string',
                description: 'Ingredient name for density-aware conversion',
              },
            },
            required: ['quantity', 'fromUnit', 'toUnit'],
          },
        },
      },
    ];
  }

  private async executeRecipeTool(
    toolName: string,
    args: RecipeToolArgs,
  ): Promise<Record<string, unknown>> {
    switch (toolName) {
      case 'get_bar_inventory': {
        const limit = args.limit || 50;
        const result = await this.barInventoryService.getInventory({
          limit,
          page: 1,
        });
        const items = (result as { data?: ToolInventoryItem[] }).data || [];
        return {
          items: items.map((item) => ({
            name: item.ingredient?.name || 'Unknown',
            quantity: item.quantity?.toString() || '0',
            unit: item.unit || item.ingredient?.baseUnit || 'units',
          })),
        };
      }
      case 'search_cocktails': {
        const result = await this.aggregatorService.searchUnified(
          args.name || '',
          { limit: args.limit || 10, page: 1 },
        );
        const cocktails = (
          (result as { data?: ToolSearchCocktailItem[] }).data || []
        ).map((c) => ({
          id: c.id,
          name: c.name,
          source: c.source,
          ingredientCount: c.ingredients?.length || 0,
        }));
        return { cocktails, total: cocktails.length };
      }
      case 'get_cocktail_detail': {
        const cocktail = await this.cocktailRepository.findOne({
          where: { id: args.cocktailId, isDeleted: false },
          relations: ['ingredients', 'ingredients.ingredient'],
        });
        if (!cocktail) return { error: 'Cocktail not found' };
        return {
          id: cocktail.id,
          name: cocktail.name,
          description: cocktail.description,
          instructions: cocktail.instructions,
          ingredients: cocktail.ingredients.map((ci) => ({
            name: ci.ingredient?.name,
            amount: ci.amount,
            unit: ci.unit,
            measure: ci.measure,
          })),
        };
      }
      case 'convert_units': {
        try {
          const result = this.unitConverter.convert(
            new Decimal(args.quantity || 0),
            args.fromUnit || '',
            args.toUnit || '',
          );
          return {
            result: result.toString(),
            fromUnit: args.fromUnit,
            toUnit: args.toUnit,
          };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          return { error: message };
        }
      }
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  private buildRecipeFromParsed(
    parsed: ParsedRecipeData,
    request: AiRecipeRequest,
  ): AiRecipeResponse {
    const rawInstructions = Array.isArray(parsed.instructions)
      ? parsed.instructions
      : parsed.instructions
        ? [parsed.instructions]
        : [];

    const sanitizedInstructions = rawInstructions.map((step) =>
      sanitizeHtml(step),
    );
    const sanitizedIngredients = (parsed.ingredients || []).map(
      (ing: { name: string; amount: number; unit: string; note?: string }) => ({
        name: sanitizeHtml(ing.name),
        amount: parseFloat(String(ing.amount)) || 1,
        unit: sanitizeHtml(ing.unit),
        note: ing.note ? sanitizeHtml(ing.note) : undefined,
      }),
    );

    return {
      id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: sanitizeHtml(
        parsed.name ||
          `AI Generated ${request.theme ? request.theme + ' ' : ''}Cocktail`,
      ),
      description: sanitizeHtml(
        parsed.description || 'An AI-generated cocktail recipe',
      ),
      instructions: sanitizedInstructions,
      ingredients:
        parsed.ingredients && parsed.ingredients.length > 0
          ? sanitizedIngredients
          : request.ingredients.map((ing) => ({
              name: ing,
              amount: 1,
              unit: 'oz',
              note: 'Adjust to taste',
            })),
      metadata: {
        difficulty: request.difficulty || 'medium',
        preparationTime: sanitizeHtml(
          parsed.metadata?.preparationTime || '5 minutes',
        ),
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
  }

  private validateGeneratedRecipe(
    recipe: AiRecipeResponse,
    ingredientValidation: IngredientValidationResult,
    strict: boolean = false,
  ): AiRecipeValidationResult {
    const issues: AiRecipeValidationResult['issues'] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = new Decimal(1.0); // Start with perfect score

    // 1. Validate recipe structure
    if (!recipe.name || recipe.name.trim().length === 0) {
      issues.push({
        type: 'format',
        severity: 'high',
        message: 'Recipe name is missing',
        suggestion: 'Add a descriptive name for the cocktail',
      });
      score = score.minus(0.2);
    }

    if (!recipe.instructions || recipe.instructions.length === 0) {
      issues.push({
        type: 'instruction',
        severity: 'high',
        message: 'No instructions provided',
        suggestion: 'Add step-by-step preparation instructions',
      });
      score = score.minus(0.3);
    }

    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      issues.push({
        type: 'ingredient',
        severity: 'critical',
        message: 'No ingredients specified',
        suggestion: 'Add at least one ingredient',
      });
      score = score.minus(0.5);
    }

    // 2. Validate ingredient amounts and units
    for (const ingredient of recipe.ingredients) {
      if (ingredient.amount <= 0) {
        issues.push({
          type: 'ingredient',
          severity: 'medium',
          message: `Invalid amount for ${ingredient.name}: ${ingredient.amount}`,
          suggestion: 'Use positive amounts for ingredients',
        });
        score = score.minus(0.05);
      }

      if (!ingredient.unit || ingredient.unit.trim().length === 0) {
        issues.push({
          type: 'ingredient',
          severity: 'low',
          message: `Missing unit for ${ingredient.name}`,
          suggestion: 'Specify a unit (ml, oz, dash, etc.)',
        });
        score = score.minus(0.02);
      }

      // Check for unrealistic amounts
      if (ingredient.unit === 'ml' && ingredient.amount > 1000) {
        warnings.push(
          `Large amount of ${ingredient.name}: ${ingredient.amount}ml`,
        );
        score = score.minus(0.01);
      }

      if (ingredient.unit === 'oz' && ingredient.amount > 32) {
        warnings.push(
          `Large amount of ${ingredient.name}: ${ingredient.amount}oz`,
        );
        score = score.minus(0.01);
      }
    }

    // 3. Check for safety issues
    const safetyIssues = this.checkForSafetyIssues(recipe);
    issues.push(...safetyIssues);
    score = score.minus(new Decimal(safetyIssues.length).times(0.1));

    // 4. Check ingredient validity
    if (ingredientValidation.invalid.length > 0) {
      issues.push({
        type: 'ingredient',
        severity: 'medium',
        message: `Unrecognized ingredients: ${ingredientValidation.invalid.join(', ')}`,
        suggestion: 'Use common, recognized ingredient names',
      });
      score = score.minus(
        new Decimal(ingredientValidation.invalid.length).times(0.05),
      );
    }

    // 5. Check for completeness
    if (recipe.instructions.length < 2) {
      warnings.push('Recipe instructions are very brief');
      score = score.minus(0.05);
    }

    if (recipe.ingredients.length < 2) {
      warnings.push('Recipe has very few ingredients');
      score = score.minus(0.05);
    }

    // 6. In strict mode, require higher standards
    if (strict && score.lt(0.9)) {
      issues.push({
        type: 'format',
        severity: 'medium',
        message: 'Recipe does not meet strict validation standards',
        suggestion: 'Improve recipe completeness and accuracy',
      });
    }

    // Ensure score is between 0 and 1
    const finalScore = Decimal.max(0, Decimal.min(1, score)).toNumber();

    return {
      isValid:
        issues.filter((i) => i.severity === 'critical').length === 0 &&
        finalScore >= 0.7,
      score: finalScore,
      issues,
      warnings,
      suggestions: [
        ...suggestions,
        ...ingredientValidation.suggestions.map((s) => s.suggestion),
      ],
    };
  }

  private checkForSafetyIssues(
    recipe: AiRecipeResponse,
  ): AiRecipeValidationResult['issues'] {
    const issues: AiRecipeValidationResult['issues'] = [];

    // Check for high alcohol content
    const alcoholKeywords = [
      'everclear',
      'grain alcohol',
      'pure ethanol',
      'moonshine',
    ];
    for (const ingredient of recipe.ingredients) {
      if (
        alcoholKeywords.some((keyword) =>
          ingredient.name.toLowerCase().includes(keyword),
        )
      ) {
        issues.push({
          type: 'safety',
          severity: 'high',
          message: `High-proof alcohol detected: ${ingredient.name}`,
          suggestion: 'Use standard proof spirits instead',
        });
      }
    }

    // Check for dangerous combinations
    const hasMultipleHighProof =
      recipe.ingredients.filter((ing) =>
        alcoholKeywords.some((keyword) =>
          ing.name.toLowerCase().includes(keyword),
        ),
      ).length > 1;

    if (hasMultipleHighProof) {
      issues.push({
        type: 'safety',
        severity: 'critical',
        message:
          'Multiple high-proof alcohols detected - dangerous combination',
        suggestion: 'Limit to one high-proof spirit per recipe',
      });
    }

    // Check for non-food items
    const nonFoodKeywords = [
      'cleaner',
      'solvent',
      'chemical',
      'fuel',
      'antifreeze',
    ];
    for (const ingredient of recipe.ingredients) {
      if (
        nonFoodKeywords.some((keyword) =>
          ingredient.name.toLowerCase().includes(keyword),
        )
      ) {
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

  private async checkForDuplicateRecipe(
    recipe: AiRecipeResponse,
  ): Promise<boolean> {
    // Simple duplicate check based on ingredient names
    const ingredientNames = recipe.ingredients
      .map((ing) => ing.name.toLowerCase())
      .sort();

    // Check a capped set of recent AI recipes to avoid unbounded memory
    const similarRecipes = await this.cocktailRepository
      .createQueryBuilder('cocktail')
      .innerJoinAndSelect('cocktail.ingredients', 'ci')
      .innerJoinAndSelect('ci.ingredient', 'ingredient')
      .where('cocktail.source = :source', { source: 'ai' })
      .orderBy('cocktail.createdAt', 'DESC')
      .take(50)
      .getMany();

    for (const similarRecipe of similarRecipes) {
      const similarIngredientNames = similarRecipe.ingredients
        .map((ing) => ing.ingredient.name.toLowerCase())
        .sort();

      const intersection = ingredientNames.filter((name) =>
        similarIngredientNames.includes(name),
      );

      const similarity =
        intersection.length /
        Math.max(ingredientNames.length, similarIngredientNames.length);

      if (similarity > 0.8) {
        return true;
      }
    }

    return false;
  }

  private generateSafetyWarnings(
    recipe: AiRecipeResponse,
    validation: AiRecipeValidationResult,
  ): string[] {
    const warnings: string[] = [];

    // Add standard warnings
    warnings.push('Drink responsibly. Do not drink and drive.');
    warnings.push(
      'This is an AI-generated recipe. Use caution and common sense.',
    );

    // Add ingredient-specific warnings
    const highAlcoholIngredients = recipe.ingredients.filter((ing) =>
      ['everclear', 'grain alcohol', 'pure ethanol'].some((keyword) =>
        ing.name.toLowerCase().includes(keyword),
      ),
    );

    if (highAlcoholIngredients.length > 0) {
      warnings.push('High-proof alcohols can be dangerous. Handle with care.');
    }

    // Add validation-based warnings
    if (validation.issues.some((issue) => issue.type === 'safety')) {
      warnings.push(
        'This recipe has safety concerns. Review carefully before making.',
      );
    }

    if (validation.score < 0.8) {
      warnings.push(
        'This recipe has validation issues. Consider modifying before use.',
      );
    }

    return warnings;
  }

  private async recordGeneration(
    userId: string,
    recipe: AiRecipeResponse,
    validation: AiRecipeValidationResult,
  ): Promise<void> {
    const aiRecord = this.aiRepository.create({
      user: { id: userId },
      prompt: JSON.stringify({
        ingredients: recipe.ingredients.map((ing) => ing.name),
        theme: recipe.metadata.theme,
        difficulty: recipe.metadata.difficulty,
      }),
      recipeData: JSON.stringify(recipe),
      validationScore: validation.score,
      isValid: validation.isValid,
      attempts: recipe.metadata.attempts,
    });

    await this.aiRepository.save(aiRecord);
  }

  private async mapIngredientsToEntities(
    ingredients: Array<{ name: string; amount: number; unit: string }>,
    userId: string,
  ): Promise<Ingredient[]> {
    const entities: Ingredient[] = [];
    const lookupNames = ingredients.map((i) => i.name.toLowerCase());

    // Bulk lookup existing ingredients to avoid N+1 queries
    const normalizedNames = lookupNames.map((n) => n.toUpperCase().trim());
    const existingIngredients = await this.ingredientRepository.find({
      where: normalizedNames.map((name) => ({ normalizedName: name })),
    });
    const ingredientMap = new Map(
      existingIngredients.map((i) => [i.normalizedName.toLowerCase(), i]),
    );

    for (const ingredient of ingredients) {
      const lookupName = ingredient.name.toLowerCase();
      let entity = ingredientMap.get(lookupName);

      if (!entity) {
        entity = this.ingredientRepository.create({
          name: lookupName,
          baseUnit: this.determineBaseUnit(ingredient.unit),
          isGlobal: false,
          createdBy: userId,
        });
        entity = await this.ingredientRepository.save(entity);
        ingredientMap.set(lookupName, entity);
      }

      entities.push(entity);
    }

    return entities;
  }

  private determineBaseUnit(unit: string): string {
    const unitMap: Record<string, string> = {
      ml: 'ml',
      oz: 'ml', // Convert oz to ml as base
      cl: 'ml',
      l: 'ml',
      dash: 'dashes',
      drop: 'drops',
      splash: 'splashes',
      part: 'parts',
      slice: 'slices',
      wedge: 'wedges',
      twist: 'twists',
      sprig: 'sprigs',
      leaf: 'leaves',
    };

    return unitMap[unit.toLowerCase()] || 'count';
  }

  async findOne(id: string, userId?: string) {
    const where: any = { id };
    if (userId) {
      where.user = { id: userId };
    }
    const aiRecipe = await this.aiRepository.findOne({
      where,
      relations: ['user'],
    });
    if (!aiRecipe)
      throw new NotFoundException(
        `AI generated recipe with ID ${id} not found`,
      );
    return aiRecipe;
  }

  async update(id: string, updateAiDto: UpdateAiDto, userId?: string) {
    const aiRecipe = await this.findOne(id, userId);
    Object.assign(aiRecipe, updateAiDto);
    return await this.aiRepository.save(aiRecipe);
  }

  async remove(id: string, userId?: string) {
    const aiRecipe = await this.findOne(id, userId);
    return await this.aiRepository.remove(aiRecipe);
  }
}
