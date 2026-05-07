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
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ai_entity_1 = require("./entities/ai.entity");
const user_entity_1 = require("../users/entities/user.entity");
const ingredient_entity_1 = require("../ingredients/entities/ingredient.entity");
const cocktail_entity_1 = require("../cocktails/entities/cocktail.entity");
const cocktail_ingredient_entity_1 = require("../cocktails/entities/cocktail-ingredient.entity");
const config_1 = require("@nestjs/config");
const llm_adapter_service_1 = require("../external/llm/llm-adapter.service");
let AiService = AiService_1 = class AiService {
    aiRepository;
    userRepository;
    ingredientRepository;
    cocktailRepository;
    llmAdapterService;
    configService;
    logger = new common_1.Logger(AiService_1.name);
    constructor(aiRepository, userRepository, ingredientRepository, cocktailRepository, llmAdapterService, configService) {
        this.aiRepository = aiRepository;
        this.userRepository = userRepository;
        this.ingredientRepository = ingredientRepository;
        this.cocktailRepository = cocktailRepository;
        this.llmAdapterService = llmAdapterService;
        this.configService = configService;
    }
    getAiProvider() {
        return this.llmAdapterService;
    }
    async generateRecipe(createAiDto) {
        const mockUser = await this.userRepository.findOne({ where: { email: 'mock@test.com' } });
        if (!mockUser)
            throw new common_1.NotFoundException('Mock user not found.');
        const aiProvider = this.getAiProvider();
        const recipe = await aiProvider.generateRecipe(createAiDto.ingredients);
        const aiRecipe = this.aiRepository.create({
            prompt: `Ingredients: ${createAiDto.ingredients.join(', ')}`,
            generated_recipe: recipe,
            user: mockUser,
        });
        return await this.aiRepository.save(aiRecipe);
    }
    async saveAsCocktail(id, saveDto) {
        const aiRecord = await this.findOne(id);
        const recipe = aiRecord.generated_recipe;
        return await this.cocktailRepository.manager.transaction(async (em) => {
            const newCocktail = em.create(cocktail_entity_1.Cocktail, {
                name: saveDto.name,
                instructions: recipe.instructions,
                user: aiRecord.user,
                source: 'ai'
            });
            const savedCocktail = await em.save(newCocktail);
            for (const item of recipe.ingredients) {
                let ingredient = await em.findOne(ingredient_entity_1.Ingredient, { where: { name: item.name.toLowerCase() } });
                if (!ingredient) {
                    ingredient = em.create(ingredient_entity_1.Ingredient, { name: item.name.toLowerCase(), baseUnit: 'ml' });
                    ingredient = await em.save(ingredient);
                }
                const cocktailIngredient = em.create(cocktail_ingredient_entity_1.CocktailIngredient, {
                    cocktail: savedCocktail,
                    ingredient: ingredient,
                    measure: item.measure,
                    amount: 1,
                    unit: 'ml'
                });
                await em.save(cocktailIngredient);
            }
            return savedCocktail;
        });
    }
    async findAll(paginationQuery) {
        const { limit = 10, page = 1 } = paginationQuery;
        const offset = (page - 1) * limit;
        const [data, total] = await this.aiRepository.findAndCount({
            relations: ['user'],
            skip: offset,
            take: limit,
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
                totalPages
            }
        };
    }
    async findOne(id) {
        const aiRecipe = await this.aiRepository.findOne({ where: { id }, relations: ['user'] });
        if (!aiRecipe)
            throw new common_1.NotFoundException(`AI generated recipe with ID ${id} not found`);
        return aiRecipe;
    }
    async update(id, updateAiDto) {
        const aiRecipe = await this.findOne(id);
        Object.assign(aiRecipe, updateAiDto);
        return await this.aiRepository.save(aiRecipe);
    }
    async remove(id) {
        const aiRecipe = await this.findOne(id);
        return await this.aiRepository.remove(aiRecipe);
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ai_entity_1.Ai)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(2, (0, typeorm_1.InjectRepository)(ingredient_entity_1.Ingredient)),
    __param(3, (0, typeorm_1.InjectRepository)(cocktail_entity_1.Cocktail)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        llm_adapter_service_1.LlmAdapterService,
        config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map