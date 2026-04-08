import { Injectable, Logger, BadRequestException, InternalServerErrorException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Ai } from './entities/ai.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
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

@Injectable()
export class EnhancedAiService {
  private readonly logger = new Logger(EnhancedAiService.name);
  private readonly MAX_RECIPES_PER_DAY = 50;
  private readonly MAX_INGREDIENTS_PER_RECIPE = 15;
  private readonly BANNED_INGREDIENTS = [
    'methanol', 'ethanol (pure)', 'industrial alcohol', 'denatured alcohol',
    'toxic berries', 'poisonous plants', 'household chemicals', 'bleach',
    'ammonia', 'gasoline', 'paint thinner', 'antifreeze',
  ];
  private readonly BANNED_THEMES = [
    'drugs', 'illegal substances', 'explicit', 'offensive',
    'dangerous challenges', 'harmful', 'toxic', 'poison',
  ];
  private userDailyCounts: Map<string, { count: number; date: string }> = new Map();

  constructor(
    @InjectRepository(Ai) private readonly aiRepository: Repository<Ai>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Ingredient) private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(Cocktail) private readonly cocktailRepository: Repository<Cocktail>,
    private readonly hierarchicalIngredientService: HierarchicalIngredientService,
    private readonly externalService: EnhancedTheCocktailDbService,
    private readonly llmAdapterService: LlmAdapterService,
    private readonly configService: ConfigService,
  ) {}

  async generateRecipe(
    userId: string,
    request: AiRecipeRequest,
  ): Promise<AiRecipeResponse> {
    // 1. Rate limiting and quota check
    await this.checkUserQuota(userId);

    // 2. Validate and sanitize inputs
    const sanitizedRequest = this.sanitizeAndValidateRequest(request);

    // 3. Check for banned content
    this.checkForBannedContent(sanitizedRequest);

    // 4. Validate ingredients against database
    const validatedIngredients = await this.validateIngredients(sanitizedRequest.ingredients);

    // 5. Generate recipe with multiple attempts if needed
    const maxAttempts = sanitizedRequest.options?.maxAttempts || 3;
    let bestRecipe: any = null;
    let bestValidation: AiRecipeValidationResult | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.log(`Attempt ${attempt}/${maxAttempts} for user ${userId}`);

        // 6. Generate recipe using AI provider
        const aiProvider = this.getAiProvider();
        const rawRecipe = await aiProvider.generateRecipe(
          validatedIngredients.valid.map(ing => ing.name),
          {
            theme: sanitizedRequest.theme,
            difficulty: sanitizedRequest.difficulty,
            language: sanitizedRequest.language || 'en',
          }
        );

        // 7. Parse and normalize the recipe
        const parsedRecipe = this.parseAiResponse(rawRecipe, sanitizedRequest);

        // 8. Validate the generated recipe
        const validation = await this.validateGeneratedRecipe(parsedRecipe, validatedIngredients);

        // 9. Check if this is the best attempt so far
        if (!bestRecipe || validation.score > (bestValidation?.score || 0)) {
          bestRecipe = parsedRecipe;
          bestValidation = validation;
        }

        // 10. If validation passes threshold, accept it
        if (validation.score >= 0.8 && validation.isValid) {
          this.logger.log(`Recipe validation passed on attempt ${attempt} with score ${validation.score}`);
          break;
        }

        // 11. Log validation issues for debugging
        if (validation.issues.length > 0) {
          this.logger.warn(`Validation issues on attempt ${attempt}:`, validation.issues);
        }

      } catch (error) {
        this.logger.error(`Attempt ${attempt} failed:`, error);
        
        if (attempt === maxAttempts) {
          throw new InternalServerErrorException(
            `Failed to generate valid recipe after ${maxAttempts} attempts. ` +
            `Last error: ${error.message}`
          );
        }
      }
    }

    if (!bestRecipe || !bestValidation) {
      throw new InternalServerErrorException('Failed to generate any valid recipe');
    }

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
      bestRecipe.metadata.safetyWarnings = this.generateSafetyWarnings(bestRecipe, bestValidation);
    }

    // 14. Update validation metadata
    bestRecipe.metadata.validation = {
      isValid: bestValidation.isValid && bestValidation.score >= 0.7,
      issues: bestValidation.issues.map(issue => `${issue.severity}: ${issue.message}`),
      warnings: bestValidation.warnings,
    };
    bestRecipe.metadata.attempts = maxAttempts;

    // 15. Store generation record (without saving the recipe itself)
    await this.recordGeneration(userId, bestRecipe, bestValidation);

    // 16. Increment user quota
    this.incrementUserQuota(userId);

    return bestRecipe;
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
    const recipeData = JSON.parse(aiRecord.recipe_data);
    
    // 3. Re-validate with strict rules if requested
    const validation = await this.validateGeneratedRecipe(recipeData, {
      valid: recipeData.ingredients,
      invalid: [],
      suggestions: [],
    }, options?.validateStrictly);

    if (!validation.isValid && options?.validateStrictly) {
      throw new BadRequestException(
        'Recipe validation failed: ' + validation.issues.map(i => i.message).join(', ')
      );
    }

    // 4. Map ingredients to database entities
    const ingredientEntities = await this.mapIngredientsToEntities(recipeData.ingredients);

    // 5. Create cocktail entity
    const cocktail = this.cocktailRepository.create({
      name: recipeData.name,
      description: recipeData.description,
      instructions: recipeData.instructions.join('\n'),
      is_public: options?.makePublic || false,
      source: 'ai',
      user: { id: userId },
      ingredients: ingredientEntities.map((ingredient, index) => {
        const cocktailIngredient = new CocktailIngredient();
        cocktailIngredient.ingredient = ingredient;
        cocktailIngredient.amount = recipeData.ingredients[index].amount;
        cocktailIngredient.unit = recipeData.ingredients[index].unit;
        cocktailIngredient.measure = recipeData.ingredients[index].note || '';
        return cocktailIngredient;
      }),
    });

    // 6. Save to database
    const savedCocktail = await this.cocktailRepository.save(cocktail);

    // 7. Update AI record to mark as saved
    aiRecord.saved_as_cocktail_id = savedCocktail.id;
    await this.aiRepository.save(aiRecord);

    this.logger.log(`User ${userId} saved AI recipe as cocktail ${savedCocktail.id}`);

    return savedCocktail;
  }

  async getAiRecipeHistory(
    userId: string,
    pagination: { limit: number; offset: number },
  ): Promise<{ data: any[]; total: number }> {
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

  async getRecipeValidationReport(aiRecipeId: string, userId: string): Promise<AiRecipeValidationResult> {
    const aiRecord = await this.aiRepository.findOne({
      where: { id: aiRecipeId, user: { id: userId } },
    });

    if (!aiRecord) {
      throw new NotFoundException('AI recipe not found or access denied');
    }

    const recipeData = JSON.parse(aiRecord.recipe_data);
    const validation = await this.validateGeneratedRecipe(recipeData, {
      valid: recipeData.ingredients,
      invalid: [],
      suggestions: [],
    });

    return validation;
  }

  private async checkUserQuota(userId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const userCount = this.userDailyCounts.get(userId);

    if (userCount && userCount.date === today && userCount.count >= this.MAX_RECIPES_PER_DAY) {
      throw new ForbiddenException(
        `Daily limit of ${this.MAX_RECIPES_PER_DAY} AI recipes exceeded. ` +
        `Please try again tomorrow.`
      );
    }
  }

  private incrementUserQuota(userId: string): void {
    const today = new Date().toISOString().split('T')[0];
    const userCount = this.userDailyCounts.get(userId);

    if (userCount && userCount.date === today) {
      userCount.count++;
    } else {
      this.userDailyCounts.set(userId, { count: 1, date: today });
    }
  }

  private sanitizeAndValidateRequest(request: AiRecipeRequest): AiRecipeRequest {
    // Validate ingredients
    if (!request.ingredients || !Array.isArray(request.ingredients) || request.ingredients.length === 0) {
      throw new BadRequestException('At least one ingredient is required');
    }

    if (request.ingredients.length > this.MAX_INGREDIENTS_PER_RECIPE) {
      throw new BadRequestException(
        `Maximum ${this.MAX_INGREDIENTS_PER_RECIPE} ingredients allowed per recipe`
      );
    }

    // Sanitize ingredient names
    const sanitizedIngredients = request.ingredients.map(ingredient => {
      const sanitized = ingredient.trim();
      if (sanitized.length === 0) {
        throw new BadRequestException('Ingredient names cannot be empty');
      }
      if (sanitized.length > 100) {
        throw new BadRequestException('Ingredient names cannot exceed 100 characters');
      }
      return sanitized;
    });

    // Sanitize theme
    let sanitizedTheme: string | undefined;
    if (request.theme) {
      sanitizedTheme = request.theme.trim();
      if (sanitizedTheme.length > 200) {
        throw new BadRequestException('Theme cannot exceed 200 characters');
      }
    }

    // Validate difficulty
    const validDifficulties = ['easy', 'medium', 'hard'];
    const sanitizedDifficulty = request.difficulty && validDifficulties.includes(request.difficulty)
      ? request.difficulty
      : 'medium';

    // Validate serving size
    const sanitizedServingSize = request.servingSize
      ? Math.max(1, Math.min(20, request.servingSize))
      : 1;

    // Validate language
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

  private checkForBannedContent(request: AiRecipeRequest): void {
    // Check banned ingredients
    const bannedFound = request.ingredients.filter(ingredient =>
      this.BANNED_INGREDIENTS.some(banned =>
        ingredient.toLowerCase().includes(banned.toLowerCase())
      )
    );

    if (bannedFound.length > 0) {
      throw new ForbiddenException(
        `Banned ingredients detected: ${bannedFound.join(', ')}. ` +
        `Please use safe, food-grade ingredients only.`
      );
    }

    // Check banned themes
    if (request.theme) {
      const isBannedTheme = this.BANNED_THEMES.some(banned =>
        request.theme!.toLowerCase().includes(banned.toLowerCase())
      );

      if (isBannedTheme) {
        throw new ForbiddenException(
          'Requested theme contains inappropriate content. ' +
          'Please choose a different theme.'
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
        const match = await this.hierarchicalIngredientService.findBestMatch(ingredient, {
          includeHierarchical: true,
          includeSynonyms: true,
          minConfidence: 0.6,
        });

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
          const externalCheck = await this.externalService.searchByIngredient(ingredient);
          if (externalCheck && externalCheck.length > 0) {
            valid.push({ name: ingredient });
          } else {
            invalid.push(ingredient);
            suggestions.push({
              original: ingredient,
              suggestion: 'Ingredient not recognized. Please check spelling or use a common alternative.',
            });
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to validate ingredient "${ingredient}":`, error);
        valid.push({ name: ingredient }); // Allow unknown ingredients with warning
      }
    }

    return { valid, invalid, suggestions };
  }

  private getAiProvider(): any {
    // Always use the LLM adapter service
    return this.llmAdapterService;
  }

  private parseAiResponse(rawResponse: any, request: AiRecipeRequest): AiRecipeResponse {
    // This is a simplified parser - in reality, you'd need to handle
    // various AI response formats and normalize them
    
    const defaultRecipe: AiRecipeResponse = {
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

    // Try to extract structured data from AI response
    if (typeof rawResponse === 'string') {
      try {
        const parsed = JSON.parse(rawResponse);
        if (parsed.name) defaultRecipe.name = parsed.name;
        if (parsed.description) defaultRecipe.description = parsed.description;
        if (parsed.instructions) defaultRecipe.instructions = Array.isArray(parsed.instructions) 
          ? parsed.instructions 
          : [parsed.instructions];
        if (parsed.ingredients) defaultRecipe.ingredients = parsed.ingredients;
      } catch (error) {
        // If not JSON, try to parse as text
        defaultRecipe.description = rawResponse.substring(0, 200) + '...';
      }
    } else if (rawResponse && typeof rawResponse === 'object') {
      // Already an object, merge with defaults
      Object.assign(defaultRecipe, rawResponse);
    }

    return defaultRecipe;
  }

  private async validateGeneratedRecipe(
    recipe: AiRecipeResponse,
    ingredientValidation: any,
    strict: boolean = false,
  ): Promise<AiRecipeValidationResult> {
    const issues: AiRecipeValidationResult['issues'] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0; // Start with perfect score

    // 1. Validate recipe structure
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

    // 2. Validate ingredient amounts and units
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

      // Check for unrealistic amounts
      if (ingredient.unit === 'ml' && ingredient.amount > 1000) {
        warnings.push(`Large amount of ${ingredient.name}: ${ingredient.amount}ml`);
        score -= 0.01;
      }

      if (ingredient.unit === 'oz' && ingredient.amount > 32) {
        warnings.push(`Large amount of ${ingredient.name}: ${ingredient.amount}oz`);
        score -= 0.01;
      }
    }

    // 3. Check for safety issues
    const safetyIssues = this.checkForSafetyIssues(recipe);
    issues.push(...safetyIssues);
    score -= safetyIssues.length * 0.1;

    // 4. Check ingredient validity
    if (ingredientValidation.invalid.length > 0) {
      issues.push({
        type: 'ingredient',
        severity: 'medium',
        message: `Unrecognized ingredients: ${ingredientValidation.invalid.join(', ')}`,
        suggestion: 'Use common, recognized ingredient names',
      });
      score -= ingredientValidation.invalid.length * 0.05;
    }

    // 5. Check for completeness
    if (recipe.instructions.length < 2) {
      warnings.push('Recipe instructions are very brief');
      score -= 0.05;
    }

    if (recipe.ingredients.length < 2) {
      warnings.push('Recipe has very few ingredients');
      score -= 0.05;
    }

    // 6. In strict mode, require higher standards
    if (strict && score < 0.9) {
      issues.push({
        type: 'format',
        severity: 'medium',
        message: 'Recipe does not meet strict validation standards',
        suggestion: 'Improve recipe completeness and accuracy',
      });
    }

    // Ensure score is between 0 and 1
    score = Math.max(0, Math.min(1, score));

    return {
      isValid: issues.filter(i => i.severity === 'critical').length === 0 && score >= 0.7,
      score,
      issues,
      warnings,
      suggestions: [...suggestions, ...ingredientValidation.suggestions.map(s => s.suggestion)],
    };
  }

  private checkForSafetyIssues(recipe: AiRecipeResponse): AiRecipeValidationResult['issues'] {
    const issues: AiRecipeValidationResult['issues'] = [];

    // Check for high alcohol content
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

    // Check for dangerous combinations
    const hasMultipleHighProof = recipe.ingredients.filter(ing =>
      alcoholKeywords.some(keyword => ing.name.toLowerCase().includes(keyword))
    ).length > 1;

    if (hasMultipleHighProof) {
      issues.push({
        type: 'safety',
        severity: 'critical',
        message: 'Multiple high-proof alcohols detected - dangerous combination',
        suggestion: 'Limit to one high-proof spirit per recipe',
      });
    }

    // Check for non-food items
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

  private async checkForDuplicateRecipe(recipe: AiRecipeResponse): Promise<boolean> {
    // Simple duplicate check based on ingredient names
    const ingredientNames = recipe.ingredients.map(ing => ing.name.toLowerCase()).sort();
    
    // Check local database for similar recipes
    const similarRecipes = await this.cocktailRepository
      .createQueryBuilder('cocktail')
      .innerJoin('cocktail.ingredients', 'ingredient')
      .where('cocktail.source = :source', { source: 'ai' })
      .getMany();

    for (const similarRecipe of similarRecipes) {
      const similarIngredientNames = similarRecipe.ingredients
        .map(ing => ing.ingredient.name.toLowerCase())
        .sort();
      
      // Simple similarity check (could be enhanced with more sophisticated algorithm)
      const intersection = ingredientNames.filter(name => 
        similarIngredientNames.includes(name)
      );
      
      const similarity = intersection.length / Math.max(ingredientNames.length, similarIngredientNames.length);
      
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
    warnings.push('This is an AI-generated recipe. Use caution and common sense.');

    // Add ingredient-specific warnings
    const highAlcoholIngredients = recipe.ingredients.filter(ing =>
      ['everclear', 'grain alcohol', 'pure ethanol'].some(keyword =>
        ing.name.toLowerCase().includes(keyword)
      )
    );

    if (highAlcoholIngredients.length > 0) {
      warnings.push('High-proof alcohols can be dangerous. Handle with care.');
    }

    // Add validation-based warnings
    if (validation.issues.some(issue => issue.type === 'safety')) {
      warnings.push('This recipe has safety concerns. Review carefully before making.');
    }

    if (validation.score < 0.8) {
      warnings.push('This recipe has validation issues. Consider modifying before use.');
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

  private async mapIngredientsToEntities(
    ingredients: Array<{ name: string; amount: number; unit: string }>,
  ): Promise<Ingredient[]> {
    const entities: Ingredient[] = [];

    for (const ingredient of ingredients) {
      // Try to find existing ingredient
      let entity = await this.ingredientRepository.findOne({
        where: { name: ingredient.name.toLowerCase() },
      });

      // If not found, create a new one (user-generated)
      if (!entity) {
        entity = this.ingredientRepository.create({
          name: ingredient.name.toLowerCase(),
          baseUnit: this.determineBaseUnit(ingredient.unit),
          createdBy: 'ai-generated', // Mark as AI-generated
        });
        entity = await this.ingredientRepository.save(entity);
      }

      entities.push(entity);
    }

    return entities;
  }

  private determineBaseUnit(unit: string): string {
    const unitMap: Record<string, string> = {
      'ml': 'ml',
      'oz': 'ml', // Convert oz to ml as base
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

    return unitMap[unit.toLowerCase()] || 'units';
  }
}