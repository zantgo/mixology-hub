import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Ingredient } from './entities/ingredient.entity';

export interface IngredientMatch {
  ingredient: Ingredient;
  matchType: 'exact' | 'hierarchical' | 'synonym' | 'fuzzy';
  confidence: number;
  path?: string[]; // For hierarchical matches: [child, parent, grandparent]
}

export interface IngredientSubstitution {
  original: Ingredient;
  substitute: Ingredient;
  matchType: 'hierarchical' | 'synonym';
  confidence: number;
  notes?: string;
}

@Injectable()
export class HierarchicalIngredientService {
  private readonly logger = new Logger(HierarchicalIngredientService.name);
  private readonly CACHE_TTL = 3600; // 1 hour in seconds
  private readonly CACHE_PREFIX = 'ingredient:hierarchy:';

  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findBestMatch(
    ingredientName: string,
    options?: { includeHierarchical?: boolean; includeSynonyms?: boolean; minConfidence?: number },
  ): Promise<IngredientMatch | null> {
    const normalizedName = this.normalizeName(ingredientName);
    const includeHierarchical = options?.includeHierarchical ?? true;
    const includeSynonyms = options?.includeSynonyms ?? true;
    const minConfidence = options?.minConfidence ?? 0.7;

    // 1. Try exact match
    const exactMatch = await this.findExactMatch(normalizedName);
    if (exactMatch) {
      return {
        ingredient: exactMatch,
        matchType: 'exact',
        confidence: 1.0,
      };
    }

    // 2. Try hierarchical matches
    if (includeHierarchical) {
      const hierarchicalMatch = await this.findHierarchicalMatch(normalizedName);
      if (hierarchicalMatch && hierarchicalMatch.confidence >= minConfidence) {
        return hierarchicalMatch;
      }
    }

    // 3. Try synonym matches
    if (includeSynonyms) {
      const synonymMatch = await this.findSynonymMatch(normalizedName);
      if (synonymMatch && synonymMatch.confidence >= minConfidence) {
        return synonymMatch;
      }
    }

    // 4. Try fuzzy match (fallback)
    const fuzzyMatch = await this.findFuzzyMatch(normalizedName);
    if (fuzzyMatch && fuzzyMatch.confidence >= minConfidence) {
      return fuzzyMatch;
    }

    return null;
  }

  async findSubstitutions(
    ingredientId: string,
    options?: { maxSubstitutions?: number; minConfidence?: number },
  ): Promise<IngredientSubstitution[]> {
    const ingredient = await this.getIngredientById(ingredientId);
    if (!ingredient) {
      return [];
    }

    const maxSubstitutions = options?.maxSubstitutions ?? 5;
    const minConfidence = options?.minConfidence ?? 0.8;
    const substitutions: IngredientSubstitution[] = [];

    // 1. Hierarchical substitutions (parent/child relationships)
    const hierarchicalSubs = await this.findHierarchicalSubstitutions(ingredient, minConfidence);
    substitutions.push(...hierarchicalSubs.slice(0, maxSubstitutions));

    // 2. Synonym substitutions
    if (substitutions.length < maxSubstitutions) {
      const synonymSubs = await this.findSynonymSubstitutions(ingredient, minConfidence);
      const remainingSlots = maxSubstitutions - substitutions.length;
      substitutions.push(...synonymSubs.slice(0, remainingSlots));
    }

    // Sort by confidence (highest first)
    return substitutions.sort((a, b) => b.confidence - a.confidence);
  }

  async buildIngredientHierarchy(ingredientId: string): Promise<{
    ingredient: Ingredient;
    ancestors: Ingredient[];
    descendants: Ingredient[];
    siblings: Ingredient[];
  }> {
    const ingredient = await this.getIngredientById(ingredientId);
    if (!ingredient) {
      throw new Error(`Ingredient ${ingredientId} not found`);
    }

    const [ancestors, descendants, siblings] = await Promise.all([
      this.getAncestors(ingredientId),
      this.getDescendants(ingredientId),
      this.getSiblings(ingredientId),
    ]);

    return {
      ingredient,
      ancestors,
      descendants,
      siblings,
    };
  }

  async validateIngredientHierarchy(ingredientId: string): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    try {
      const hierarchy = await this.buildIngredientHierarchy(ingredientId);

      // Check for circular references
      const circular = this.detectCircularReference(hierarchy.ingredient, hierarchy.ancestors, hierarchy.descendants);
      if (circular) {
        issues.push('Circular reference detected in ingredient hierarchy');
      }

      // Check hierarchy depth (too deep might indicate incorrect relationships)
      if (hierarchy.ancestors.length > 5) {
        issues.push(`Hierarchy depth is ${hierarchy.ancestors.length} levels deep, which may be excessive`);
        suggestions.push('Consider flattening the hierarchy for better performance');
      }

      // Check for missing synonyms
      if (!hierarchy.ingredient.synonyms && hierarchy.siblings.length > 0) {
        suggestions.push('Consider adding synonyms for better matching with sibling ingredients');
      }

      // Check for consistency in base units among similar ingredients
      const unitConsistency = await this.checkUnitConsistency(hierarchy);
      if (!unitConsistency.isConsistent) {
        issues.push(`Inconsistent base units in ingredient hierarchy: ${unitConsistency.message}`);
      }

      return {
        isValid: issues.length === 0,
        issues,
        suggestions,
      };
    } catch (error) {
      this.logger.error(`Failed to validate ingredient hierarchy for ${ingredientId}:`, error);
      return {
        isValid: false,
        issues: [`Validation failed: ${error.message}`],
        suggestions: ['Check ingredient relationships in database'],
      };
    }
  }

  async findCommonAncestor(ingredientIds: string[]): Promise<Ingredient | null> {
    if (ingredientIds.length < 2) {
      return null;
    }

    // Get hierarchies for all ingredients
    const hierarchies = await Promise.all(
      ingredientIds.map(id => this.getAncestors(id).then(ancestors => ({ id, ancestors })))
    );

    // Find common ancestors
    const allAncestors = hierarchies.map(h => h.ancestors.map(a => a.id));
    
    if (allAncestors.length === 0) {
      return null;
    }

    // Find intersection of all ancestor sets
    let commonAncestorIds = allAncestors[0];
    for (let i = 1; i < allAncestors.length; i++) {
      commonAncestorIds = commonAncestorIds.filter(id => allAncestors[i].includes(id));
    }

    if (commonAncestorIds.length === 0) {
      return null;
    }

    // Return the closest common ancestor (first in the list since ancestors are ordered from parent to grandparent)
    return await this.getIngredientById(commonAncestorIds[0]);
  }

  async expandIngredientQuery(ingredientName: string): Promise<string[]> {
    const normalizedName = this.normalizeName(ingredientName);
    const matches: Set<string> = new Set([normalizedName]);

    // Find the ingredient
    const match = await this.findBestMatch(normalizedName, {
      includeHierarchical: true,
      includeSynonyms: true,
      minConfidence: 0.6,
    });

    if (match) {
      // Add the matched ingredient name
      matches.add(this.normalizeName(match.ingredient.name));

      // Add synonyms
      if (match.ingredient.synonyms) {
        const synonyms = match.ingredient.synonyms.split(',').map(s => this.normalizeName(s.trim()));
        synonyms.forEach(synonym => matches.add(synonym));
      }

      // Add hierarchical relatives
      const hierarchy = await this.buildIngredientHierarchy(match.ingredient.id);
      [...hierarchy.ancestors, ...hierarchy.descendants].forEach(rel => {
        matches.add(this.normalizeName(rel.name));
        if (rel.synonyms) {
          rel.synonyms.split(',').map(s => this.normalizeName(s.trim())).forEach(syn => matches.add(syn));
        }
      });
    }

    return Array.from(matches);
  }

  private async findExactMatch(normalizedName: string): Promise<Ingredient | null> {
    const cacheKey = `${this.CACHE_PREFIX}name:${normalizedName}`;
    
    // Check Redis cache first
    const cached = await this.cacheManager.get<Ingredient>(cacheKey);
    if (cached) {
      return cached;
    }

    const ingredient = await this.ingredientRepository.findOne({
      where: { name: normalizedName },
    });

    if (ingredient) {
      // Cache in Redis with TTL
      await this.cacheManager.set(cacheKey, ingredient, this.CACHE_TTL * 1000);
    }

    return ingredient;
  }

  private async findHierarchicalMatch(normalizedName: string): Promise<IngredientMatch | null> {
    const allIngredients = await this.ingredientRepository.find({
      relations: ['parent'],
      take: 10000, // Safety cap to prevent unbounded memory usage
    });

    // Build an in-memory parent map to avoid per-ingredient DB queries
    const parentMap = new Map<string, string | null>();
    for (const ing of allIngredients) {
      parentMap.set(ing.id, ing.parentId || null);
    }

    // Build a children index to find descendants efficiently
    const childrenMap = new Map<string, Ingredient[]>();
    for (const ing of allIngredients) {
      const pId = ing.parentId || '__root__';
      if (!childrenMap.has(pId)) {
        childrenMap.set(pId, []);
      }
      childrenMap.get(pId)!.push(ing);
    }

    // Try to find by name in hierarchy
    for (const ingredient of allIngredients) {
      if (this.normalizeName(ingredient.name) === normalizedName) {
        return {
          ingredient,
          matchType: 'exact',
          confidence: 1.0,
        };
      }

      // Check ancestors using the in-memory parent map
      const ancestors: Ingredient[] = [];
      let currentId: string | null = ingredient.parentId || null;
      while (currentId) {
        const parent = allIngredients.find((i) => i.id === currentId);
        if (!parent) break;
        ancestors.push(parent);
        if (this.normalizeName(parent.name) === normalizedName) {
          const path = [ingredient.name, ...ancestors.map((a) => a.name)];
          return {
            ingredient: parent,
            matchType: 'hierarchical',
            confidence: this.calculateHierarchicalConfidence(path.length),
            path,
          };
        }
        currentId = parentMap.get(currentId) || null;
      }

      // Check descendants using the children map
      const descendantQueue = [...(childrenMap.get(ingredient.id) || [])];
      const visited = new Set<string>();
      const pathMap = new Map<string, string[]>(); // descendantId -> path of names
      for (const child of descendantQueue) {
        pathMap.set(child.id, [ingredient.name]);
      }

      while (descendantQueue.length > 0) {
        const current = descendantQueue.shift()!;
        if (visited.has(current.id)) continue;
        visited.add(current.id);

        if (this.normalizeName(current.name) === normalizedName) {
          const path = [...(pathMap.get(current.id) || []), current.name];
          return {
            ingredient: current,
            matchType: 'hierarchical',
            confidence: this.calculateHierarchicalConfidence(path.length),
            path,
          };
        }

        const children = childrenMap.get(current.id) || [];
        for (const child of children) {
          if (!visited.has(child.id)) {
            descendantQueue.push(child);
            pathMap.set(child.id, [...(pathMap.get(current.id) || []), current.name]);
          }
        }
      }
    }

    return null;
  }

  private async findSynonymMatch(normalizedName: string): Promise<IngredientMatch | null> {
    const allIngredients = await this.ingredientRepository.find({
      take: 10000, // Safety cap to prevent unbounded memory usage
    });

    for (const ingredient of allIngredients) {
      // Check ingredient name
      if (this.normalizeName(ingredient.name) === normalizedName) {
        return {
          ingredient,
          matchType: 'exact',
          confidence: 1.0,
        };
      }

      // Check synonyms
      if (ingredient.synonyms) {
        const synonyms = ingredient.synonyms.split(',').map(s => this.normalizeName(s.trim()));
        if (synonyms.includes(normalizedName)) {
          return {
            ingredient,
            matchType: 'synonym',
            confidence: 0.9,
          };
        }
      }
    }

    return null;
  }

  private async findFuzzyMatch(normalizedName: string): Promise<IngredientMatch | null> {
    const allIngredients = await this.ingredientRepository.find({
      take: 10000, // Safety cap to prevent unbounded memory usage
    });
    let bestMatch: Ingredient | null = null;
    let bestScore = 0;

    for (const ingredient of allIngredients) {
      const score = this.calculateFuzzyScore(normalizedName, this.normalizeName(ingredient.name));
      
      if (score > bestScore && score > 0.7) {
        bestScore = score;
        bestMatch = ingredient;
      }

      // Also check synonyms
      if (ingredient.synonyms) {
        const synonyms = ingredient.synonyms.split(',').map(s => this.normalizeName(s.trim()));
        for (const synonym of synonyms) {
          const synonymScore = this.calculateFuzzyScore(normalizedName, synonym);
          if (synonymScore > bestScore && synonymScore > 0.7) {
            bestScore = synonymScore;
            bestMatch = ingredient;
          }
        }
      }
    }

    if (bestMatch) {
      return {
        ingredient: bestMatch,
        matchType: 'fuzzy',
        confidence: bestScore,
      };
    }

    return null;
  }

  private async findHierarchicalSubstitutions(
    ingredient: Ingredient,
    minConfidence: number,
  ): Promise<IngredientSubstitution[]> {
    const substitutions: IngredientSubstitution[] = [];

    // Parent substitutions (using parent ingredient)
    if (ingredient.parentId) {
      const parent = await this.getIngredientById(ingredient.parentId);
      if (parent) {
        substitutions.push({
          original: ingredient,
          substitute: parent,
          matchType: 'hierarchical',
          confidence: 0.9,
          notes: `${ingredient.name} is a type of ${parent.name}`,
        });
      }
    }

    // Child substitutions (using child ingredients)
    const children = await this.getDescendants(ingredient.id);
    for (const child of children) {
      substitutions.push({
        original: ingredient,
        substitute: child,
        matchType: 'hierarchical',
        confidence: 0.8,
        notes: `${child.name} can be used as a specific type of ${ingredient.name}`,
      });
    }

    // Sibling substitutions
    const siblings = await this.getSiblings(ingredient.id);
    for (const sibling of siblings) {
      substitutions.push({
        original: ingredient,
        substitute: sibling,
        matchType: 'hierarchical',
        confidence: 0.7,
        notes: `${sibling.name} is a sibling ingredient to ${ingredient.name}`,
      });
    }

    return substitutions.filter(sub => sub.confidence >= minConfidence);
  }

  private async findSynonymSubstitutions(
    ingredient: Ingredient,
    minConfidence: number,
  ): Promise<IngredientSubstitution[]> {
    const substitutions: IngredientSubstitution[] = [];

    if (!ingredient.synonyms) {
      return substitutions;
    }

    const synonyms = ingredient.synonyms.split(',').map(s => s.trim());
    
    // Find ingredients that have these synonyms as their primary name
    for (const synonym of synonyms) {
      const synonymIngredient = await this.findExactMatch(this.normalizeName(synonym));
      if (synonymIngredient && synonymIngredient.id !== ingredient.id) {
        substitutions.push({
          original: ingredient,
          substitute: synonymIngredient,
          matchType: 'synonym',
          confidence: 0.85,
          notes: `${synonym} is a synonym for ${ingredient.name}`,
        });
      }
    }

    return substitutions.filter(sub => sub.confidence >= minConfidence);
  }

  private async getIngredientById(id: string): Promise<Ingredient | null> {
    const cacheKey = `${this.CACHE_PREFIX}ingredient:${id}`;
    
    // Check Redis cache first
    const cached = await this.cacheManager.get<Ingredient>(cacheKey);
    if (cached) {
      return cached;
    }

    const ingredient = await this.ingredientRepository.findOne({
      where: { id },
      relations: ['parent'],
    });

    if (ingredient) {
      // Cache in Redis with TTL
      await this.cacheManager.set(cacheKey, ingredient, this.CACHE_TTL * 1000);
    }

    return ingredient;
  }

  private async getParent(ingredientId: string): Promise<Ingredient | null> {
    const ingredient = await this.getIngredientById(ingredientId);
    return ingredient?.parent || null;
  }

  private async getAncestors(ingredientId: string): Promise<Ingredient[]> {
    const cacheKey = `${this.CACHE_PREFIX}ancestors:${ingredientId}`;
    
    // Check Redis cache first
    const cached = await this.cacheManager.get<Ingredient[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const ancestors: Ingredient[] = [];
    let currentId: string | null = ingredientId;

    while (currentId) {
      const ingredient = await this.getIngredientById(currentId);
      if (!ingredient || !ingredient.parentId) break;

      const parent = await this.getIngredientById(ingredient.parentId);
      if (!parent) break;

      ancestors.push(parent);
      currentId = parent.id;
    }

    // Cache in Redis with TTL
    await this.cacheManager.set(cacheKey, ancestors, this.CACHE_TTL * 1000);
    return ancestors;
  }

  private async getDescendants(ingredientId: string): Promise<Ingredient[]> {
    const cacheKey = `${this.CACHE_PREFIX}descendants:${ingredientId}`;
    
    // Check Redis cache first
    const cached = await this.cacheManager.get<Ingredient[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const allIngredients = await this.ingredientRepository.find({
      relations: ['parent'],
    });

    const descendants: Ingredient[] = [];
    const queue: Ingredient[] = allIngredients.filter(ing => ing.parentId === ingredientId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      descendants.push(current);
      
      // Add children of current ingredient
      const children = allIngredients.filter(ing => ing.parentId === current.id);
      queue.push(...children);
    }

    // Cache in Redis with TTL
    await this.cacheManager.set(cacheKey, descendants, this.CACHE_TTL * 1000);
    return descendants;
  }

  private async getSiblings(ingredientId: string): Promise<Ingredient[]> {
    const ingredient = await this.getIngredientById(ingredientId);
    if (!ingredient || !ingredient.parentId) {
      return [];
    }

    const allIngredients = await this.ingredientRepository.find({
      where: { parentId: ingredient.parentId },
    });

    // Exclude the ingredient itself
    return allIngredients.filter(ing => ing.id !== ingredientId);
  }

  private normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private calculateHierarchicalConfidence(distance: number): number {
    // Confidence decreases with distance in hierarchy
    return Math.max(0.1, 1.0 - (distance * 0.1));
  }

  private calculateFuzzyScore(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    // Check for exact match after normalization
    if (longer === shorter) {
      return 1.0;
    }

    // Check for contains
    if (longer.includes(shorter)) {
      return 0.9;
    }

    // Check for common prefixes
    let commonPrefix = 0;
    for (let i = 0; i < Math.min(longer.length, shorter.length); i++) {
      if (longer[i] === shorter[i]) {
        commonPrefix++;
      } else {
        break;
      }
    }

    if (commonPrefix >= 3) {
      return 0.7 + (commonPrefix * 0.05);
    }

    return 0.5; // Default low confidence
  }

  private detectCircularReference(
    ingredient: Ingredient,
    ancestors: Ingredient[],
    descendants: Ingredient[],
  ): boolean {
    // Check if ingredient appears in its own ancestors or descendants
    const ancestorIds = ancestors.map(a => a.id);
    const descendantIds = descendants.map(d => d.id);
    
    return ancestorIds.includes(ingredient.id) || descendantIds.includes(ingredient.id);
  }

  private async checkUnitConsistency(hierarchy: {
    ingredient: Ingredient;
    ancestors: Ingredient[];
    descendants: Ingredient[];
    siblings: Ingredient[];
  }): Promise<{ isConsistent: boolean; message: string }> {
    const allIngredients = [
      hierarchy.ingredient,
      ...hierarchy.ancestors,
      ...hierarchy.descendants,
      ...hierarchy.siblings,
    ];

    // Group by base unit
    const units: Record<string, Ingredient[]> = {};
    allIngredients.forEach(ing => {
      const unit = ing.baseUnit || 'ml';
      if (!units[unit]) units[unit] = [];
      units[unit].push(ing);
    });

    const unitCount = Object.keys(units).length;
    
    if (unitCount > 1) {
      const unitList = Object.keys(units).join(', ');
      const exampleIngredients = Object.values(units)[0].slice(0, 3).map(ing => ing.name).join(', ');
      
      return {
        isConsistent: false,
        message: `Multiple base units found (${unitList}). Example: ${exampleIngredients} use ${Object.keys(units)[0]}`,
      };
    }

    return {
      isConsistent: true,
      message: `All ingredients use ${Object.keys(units)[0] || 'ml'} as base unit`,
    };
  }

  // Cache management
  async clearCache(): Promise<void> {
    // Redis doesn't have a simple "clear by prefix" in cache-manager
    // In production, you might want to use Redis SCAN command
    // For now, we'll just log that cache should be cleared at Redis level
    this.logger.log('Note: For Redis cache clearing, use Redis CLI or restart Redis service');
    this.logger.log('In-memory cache methods are deprecated, using Redis with TTL');
  }

  async warmupCache(): Promise<void> {
    this.logger.log('Warming up ingredient hierarchy cache in Redis...');
    
    const allIngredients = await this.ingredientRepository.find({
      relations: ['parent'],
    });

    // Cache all ingredients by ID and name in Redis
    const cachePromises = allIngredients.map(async (ingredient) => {
      const idCacheKey = `${this.CACHE_PREFIX}ingredient:${ingredient.id}`;
      const nameCacheKey = `${this.CACHE_PREFIX}name:${this.normalizeName(ingredient.name)}`;
      
      await Promise.all([
        this.cacheManager.set(idCacheKey, ingredient, this.CACHE_TTL * 1000),
        this.cacheManager.set(nameCacheKey, ingredient, this.CACHE_TTL * 1000),
      ]);
    });

    await Promise.all(cachePromises);
    this.logger.log(`Cached ${allIngredients.length} ingredients in Redis`);
  }
}