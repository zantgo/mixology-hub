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
var HierarchicalIngredientService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HierarchicalIngredientService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const cache_manager_1 = require("@nestjs/cache-manager");
const ingredient_entity_1 = require("./entities/ingredient.entity");
let HierarchicalIngredientService = HierarchicalIngredientService_1 = class HierarchicalIngredientService {
    ingredientRepository;
    cacheManager;
    logger = new common_1.Logger(HierarchicalIngredientService_1.name);
    CACHE_TTL = 3600;
    CACHE_PREFIX = 'ingredient:hierarchy:';
    constructor(ingredientRepository, cacheManager) {
        this.ingredientRepository = ingredientRepository;
        this.cacheManager = cacheManager;
    }
    async findBestMatch(ingredientName, options) {
        const normalizedName = this.normalizeName(ingredientName);
        const includeHierarchical = options?.includeHierarchical ?? true;
        const includeSynonyms = options?.includeSynonyms ?? true;
        const minConfidence = options?.minConfidence ?? 0.7;
        const exactMatch = await this.findExactMatch(normalizedName);
        if (exactMatch) {
            return {
                ingredient: exactMatch,
                matchType: 'exact',
                confidence: 1.0,
            };
        }
        if (includeHierarchical) {
            const hierarchicalMatch = await this.findHierarchicalMatch(normalizedName);
            if (hierarchicalMatch && hierarchicalMatch.confidence >= minConfidence) {
                return hierarchicalMatch;
            }
        }
        if (includeSynonyms) {
            const synonymMatch = await this.findSynonymMatch(normalizedName);
            if (synonymMatch && synonymMatch.confidence >= minConfidence) {
                return synonymMatch;
            }
        }
        const fuzzyMatch = await this.findFuzzyMatch(normalizedName);
        if (fuzzyMatch && fuzzyMatch.confidence >= minConfidence) {
            return fuzzyMatch;
        }
        return null;
    }
    async findSubstitutions(ingredientId, options) {
        const ingredient = await this.getIngredientById(ingredientId);
        if (!ingredient) {
            return [];
        }
        const maxSubstitutions = options?.maxSubstitutions ?? 5;
        const minConfidence = options?.minConfidence ?? 0.8;
        const substitutions = [];
        const hierarchicalSubs = await this.findHierarchicalSubstitutions(ingredient, minConfidence);
        substitutions.push(...hierarchicalSubs.slice(0, maxSubstitutions));
        if (substitutions.length < maxSubstitutions) {
            const synonymSubs = await this.findSynonymSubstitutions(ingredient, minConfidence);
            const remainingSlots = maxSubstitutions - substitutions.length;
            substitutions.push(...synonymSubs.slice(0, remainingSlots));
        }
        return substitutions.sort((a, b) => b.confidence - a.confidence);
    }
    async buildIngredientHierarchy(ingredientId) {
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
    async validateIngredientHierarchy(ingredientId) {
        const issues = [];
        const suggestions = [];
        try {
            const hierarchy = await this.buildIngredientHierarchy(ingredientId);
            const circular = this.detectCircularReference(hierarchy.ingredient, hierarchy.ancestors, hierarchy.descendants);
            if (circular) {
                issues.push('Circular reference detected in ingredient hierarchy');
            }
            if (hierarchy.ancestors.length > 5) {
                issues.push(`Hierarchy depth is ${hierarchy.ancestors.length} levels deep, which may be excessive`);
                suggestions.push('Consider flattening the hierarchy for better performance');
            }
            if (!hierarchy.ingredient.synonyms && hierarchy.siblings.length > 0) {
                suggestions.push('Consider adding synonyms for better matching with sibling ingredients');
            }
            const unitConsistency = await this.checkUnitConsistency(hierarchy);
            if (!unitConsistency.isConsistent) {
                issues.push(`Inconsistent base units in ingredient hierarchy: ${unitConsistency.message}`);
            }
            return {
                isValid: issues.length === 0,
                issues,
                suggestions,
            };
        }
        catch (error) {
            this.logger.error(`Failed to validate ingredient hierarchy for ${ingredientId}:`, error);
            return {
                isValid: false,
                issues: [`Validation failed: ${error.message}`],
                suggestions: ['Check ingredient relationships in database'],
            };
        }
    }
    async findCommonAncestor(ingredientIds) {
        if (ingredientIds.length < 2) {
            return null;
        }
        const hierarchies = await Promise.all(ingredientIds.map(id => this.getAncestors(id).then(ancestors => ({ id, ancestors }))));
        const allAncestors = hierarchies.map(h => h.ancestors.map(a => a.id));
        if (allAncestors.length === 0) {
            return null;
        }
        let commonAncestorIds = allAncestors[0];
        for (let i = 1; i < allAncestors.length; i++) {
            commonAncestorIds = commonAncestorIds.filter(id => allAncestors[i].includes(id));
        }
        if (commonAncestorIds.length === 0) {
            return null;
        }
        return await this.getIngredientById(commonAncestorIds[0]);
    }
    async expandIngredientQuery(ingredientName) {
        const normalizedName = this.normalizeName(ingredientName);
        const matches = new Set([normalizedName]);
        const match = await this.findBestMatch(normalizedName, {
            includeHierarchical: true,
            includeSynonyms: true,
            minConfidence: 0.6,
        });
        if (match) {
            matches.add(this.normalizeName(match.ingredient.name));
            if (match.ingredient.synonyms) {
                const synonyms = match.ingredient.synonyms.split(',').map(s => this.normalizeName(s.trim()));
                synonyms.forEach(synonym => matches.add(synonym));
            }
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
    async findExactMatch(normalizedName) {
        const cacheKey = `${this.CACHE_PREFIX}name:${normalizedName}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }
        const ingredient = await this.ingredientRepository.findOne({
            where: { name: normalizedName },
        });
        if (ingredient) {
            await this.cacheManager.set(cacheKey, ingredient, this.CACHE_TTL * 1000);
        }
        return ingredient;
    }
    async findHierarchicalMatch(normalizedName) {
        const allIngredients = await this.ingredientRepository.find({
            relations: ['parent'],
        });
        for (const ingredient of allIngredients) {
            if (this.normalizeName(ingredient.name) === normalizedName) {
                return {
                    ingredient,
                    matchType: 'exact',
                    confidence: 1.0,
                };
            }
            const ancestors = await this.getAncestors(ingredient.id);
            for (const ancestor of ancestors) {
                if (this.normalizeName(ancestor.name) === normalizedName) {
                    const path = [ingredient.name, ...ancestors.slice(0, ancestors.indexOf(ancestor) + 1).map(a => a.name)];
                    return {
                        ingredient: ancestor,
                        matchType: 'hierarchical',
                        confidence: this.calculateHierarchicalConfidence(path.length),
                        path,
                    };
                }
            }
            const descendants = await this.getDescendants(ingredient.id);
            for (const descendant of descendants) {
                if (this.normalizeName(descendant.name) === normalizedName) {
                    const path = [descendant.name];
                    let current = descendant;
                    while (current && current.id !== ingredient.id) {
                        current = await this.getParent(current.id);
                        if (current)
                            path.unshift(current.name);
                    }
                    return {
                        ingredient: descendant,
                        matchType: 'hierarchical',
                        confidence: this.calculateHierarchicalConfidence(path.length),
                        path,
                    };
                }
            }
        }
        return null;
    }
    async findSynonymMatch(normalizedName) {
        const allIngredients = await this.ingredientRepository.find();
        for (const ingredient of allIngredients) {
            if (this.normalizeName(ingredient.name) === normalizedName) {
                return {
                    ingredient,
                    matchType: 'exact',
                    confidence: 1.0,
                };
            }
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
    async findFuzzyMatch(normalizedName) {
        const allIngredients = await this.ingredientRepository.find();
        let bestMatch = null;
        let bestScore = 0;
        for (const ingredient of allIngredients) {
            const score = this.calculateFuzzyScore(normalizedName, this.normalizeName(ingredient.name));
            if (score > bestScore && score > 0.7) {
                bestScore = score;
                bestMatch = ingredient;
            }
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
    async findHierarchicalSubstitutions(ingredient, minConfidence) {
        const substitutions = [];
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
    async findSynonymSubstitutions(ingredient, minConfidence) {
        const substitutions = [];
        if (!ingredient.synonyms) {
            return substitutions;
        }
        const synonyms = ingredient.synonyms.split(',').map(s => s.trim());
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
    async getIngredientById(id) {
        const cacheKey = `${this.CACHE_PREFIX}ingredient:${id}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }
        const ingredient = await this.ingredientRepository.findOne({
            where: { id },
            relations: ['parent'],
        });
        if (ingredient) {
            await this.cacheManager.set(cacheKey, ingredient, this.CACHE_TTL * 1000);
        }
        return ingredient;
    }
    async getParent(ingredientId) {
        const ingredient = await this.getIngredientById(ingredientId);
        return ingredient?.parent || null;
    }
    async getAncestors(ingredientId) {
        const cacheKey = `${this.CACHE_PREFIX}ancestors:${ingredientId}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }
        const ancestors = [];
        let currentId = ingredientId;
        while (currentId) {
            const ingredient = await this.getIngredientById(currentId);
            if (!ingredient || !ingredient.parentId)
                break;
            const parent = await this.getIngredientById(ingredient.parentId);
            if (!parent)
                break;
            ancestors.push(parent);
            currentId = parent.id;
        }
        await this.cacheManager.set(cacheKey, ancestors, this.CACHE_TTL * 1000);
        return ancestors;
    }
    async getDescendants(ingredientId) {
        const cacheKey = `${this.CACHE_PREFIX}descendants:${ingredientId}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }
        const allIngredients = await this.ingredientRepository.find({
            relations: ['parent'],
        });
        const descendants = [];
        const queue = allIngredients.filter(ing => ing.parentId === ingredientId);
        while (queue.length > 0) {
            const current = queue.shift();
            descendants.push(current);
            const children = allIngredients.filter(ing => ing.parentId === current.id);
            queue.push(...children);
        }
        await this.cacheManager.set(cacheKey, descendants, this.CACHE_TTL * 1000);
        return descendants;
    }
    async getSiblings(ingredientId) {
        const ingredient = await this.getIngredientById(ingredientId);
        if (!ingredient || !ingredient.parentId) {
            return [];
        }
        const allIngredients = await this.ingredientRepository.find({
            where: { parentId: ingredient.parentId },
        });
        return allIngredients.filter(ing => ing.id !== ingredientId);
    }
    normalizeName(name) {
        return name.toLowerCase().trim().replace(/\s+/g, ' ');
    }
    calculateHierarchicalConfidence(distance) {
        return Math.max(0.1, 1.0 - (distance * 0.1));
    }
    calculateFuzzyScore(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0) {
            return 1.0;
        }
        if (longer === shorter) {
            return 1.0;
        }
        if (longer.includes(shorter)) {
            return 0.9;
        }
        let commonPrefix = 0;
        for (let i = 0; i < Math.min(longer.length, shorter.length); i++) {
            if (longer[i] === shorter[i]) {
                commonPrefix++;
            }
            else {
                break;
            }
        }
        if (commonPrefix >= 3) {
            return 0.7 + (commonPrefix * 0.05);
        }
        return 0.5;
    }
    detectCircularReference(ingredient, ancestors, descendants) {
        const ancestorIds = ancestors.map(a => a.id);
        const descendantIds = descendants.map(d => d.id);
        return ancestorIds.includes(ingredient.id) || descendantIds.includes(ingredient.id);
    }
    async checkUnitConsistency(hierarchy) {
        const allIngredients = [
            hierarchy.ingredient,
            ...hierarchy.ancestors,
            ...hierarchy.descendants,
            ...hierarchy.siblings,
        ];
        const units = {};
        allIngredients.forEach(ing => {
            const unit = ing.baseUnit || 'ml';
            if (!units[unit])
                units[unit] = [];
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
    async clearCache() {
        this.logger.log('Note: For Redis cache clearing, use Redis CLI or restart Redis service');
        this.logger.log('In-memory cache methods are deprecated, using Redis with TTL');
    }
    async warmupCache() {
        this.logger.log('Warming up ingredient hierarchy cache in Redis...');
        const allIngredients = await this.ingredientRepository.find({
            relations: ['parent'],
        });
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
};
exports.HierarchicalIngredientService = HierarchicalIngredientService;
exports.HierarchicalIngredientService = HierarchicalIngredientService = HierarchicalIngredientService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ingredient_entity_1.Ingredient)),
    __param(1, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [typeorm_2.Repository, Object])
], HierarchicalIngredientService);
//# sourceMappingURL=hierarchical-ingredient.service.js.map