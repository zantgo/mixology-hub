import { Repository } from 'typeorm';
import type { Cache } from 'cache-manager';
import { Ingredient } from './entities/ingredient.entity';
export interface IngredientMatch {
    ingredient: Ingredient;
    matchType: 'exact' | 'hierarchical' | 'synonym' | 'fuzzy';
    confidence: number;
    path?: string[];
}
export interface IngredientSubstitution {
    original: Ingredient;
    substitute: Ingredient;
    matchType: 'hierarchical' | 'synonym';
    confidence: number;
    notes?: string;
}
export declare class HierarchicalIngredientService {
    private readonly ingredientRepository;
    private readonly cacheManager;
    private readonly logger;
    private readonly CACHE_TTL;
    private readonly CACHE_PREFIX;
    constructor(ingredientRepository: Repository<Ingredient>, cacheManager: Cache);
    findBestMatch(ingredientName: string, options?: {
        includeHierarchical?: boolean;
        includeSynonyms?: boolean;
        minConfidence?: number;
    }): Promise<IngredientMatch | null>;
    findSubstitutions(ingredientId: string, options?: {
        maxSubstitutions?: number;
        minConfidence?: number;
    }): Promise<IngredientSubstitution[]>;
    buildIngredientHierarchy(ingredientId: string): Promise<{
        ingredient: Ingredient;
        ancestors: Ingredient[];
        descendants: Ingredient[];
        siblings: Ingredient[];
    }>;
    validateIngredientHierarchy(ingredientId: string): Promise<{
        isValid: boolean;
        issues: string[];
        suggestions: string[];
    }>;
    findCommonAncestor(ingredientIds: string[]): Promise<Ingredient | null>;
    expandIngredientQuery(ingredientName: string): Promise<string[]>;
    private findExactMatch;
    private findHierarchicalMatch;
    private findSynonymMatch;
    private findFuzzyMatch;
    private findHierarchicalSubstitutions;
    private findSynonymSubstitutions;
    private getIngredientById;
    private getParent;
    private getAncestors;
    private getDescendants;
    private getSiblings;
    private normalizeName;
    private calculateHierarchicalConfidence;
    private calculateFuzzyScore;
    private detectCircularReference;
    private checkUnitConsistency;
    clearCache(): Promise<void>;
    warmupCache(): Promise<void>;
}
