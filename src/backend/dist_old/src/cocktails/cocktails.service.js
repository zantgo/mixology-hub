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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CocktailsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const decimal_js_1 = require("decimal.js");
const cocktail_entity_1 = require("./entities/cocktail.entity");
const cocktail_ingredient_entity_1 = require("./entities/cocktail-ingredient.entity");
const ingredient_entity_1 = require("../ingredients/entities/ingredient.entity");
const user_entity_1 = require("../users/entities/user.entity");
const user_inventory_entity_1 = require("../users/entities/user-inventory.entity");
const user_inventory_service_1 = require("../users/user-inventory.service");
const unit_converter_service_1 = require("../utils/unit-converter.service");
let CocktailsService = class CocktailsService {
    cocktailRepository;
    cocktailIngredientRepository;
    ingredientRepository;
    userRepository;
    inventoryService;
    unitConverter;
    constructor(cocktailRepository, cocktailIngredientRepository, ingredientRepository, userRepository, inventoryService, unitConverter) {
        this.cocktailRepository = cocktailRepository;
        this.cocktailIngredientRepository = cocktailIngredientRepository;
        this.ingredientRepository = ingredientRepository;
        this.userRepository = userRepository;
        this.inventoryService = inventoryService;
        this.unitConverter = unitConverter;
    }
    async create(createCocktailDto, userId) {
        let user;
        if (userId) {
            user = await this.userRepository.findOne({
                where: { id: userId }
            });
        }
        else {
            user = await this.userRepository.findOne({
                where: { email: 'mock@test.com' }
            });
        }
        if (!user) {
            throw new common_1.NotFoundException('User not found in database');
        }
        const cocktail = await this.cocktailRepository.manager.transaction(async (transactionalEntityManager) => {
            const newCocktail = this.cocktailRepository.create({
                name: createCocktailDto.name,
                description: createCocktailDto.description,
                instructions: createCocktailDto.instructions,
                image_full: createCocktailDto.imageFull,
                image_thumb: createCocktailDto.imageThumb,
                is_public: createCocktailDto.isPublic ?? true,
                user: user,
            });
            const savedCocktail = await transactionalEntityManager.save(newCocktail);
            for (const item of createCocktailDto.ingredients) {
                const ingredient = await transactionalEntityManager.findOne(ingredient_entity_1.Ingredient, {
                    where: { id: item.ingredientId },
                });
                if (!ingredient) {
                    throw new common_1.NotFoundException(`Ingredient with ID ${item.ingredientId} not found`);
                }
                const cocktailIngredient = this.cocktailIngredientRepository.create({
                    cocktail: savedCocktail,
                    ingredient: ingredient,
                    measure: item.measure,
                    amount: item.amount,
                    unit: item.unit
                });
                await transactionalEntityManager.save(cocktailIngredient);
            }
            return savedCocktail;
        });
        const completeCocktail = await this.cocktailRepository.findOne({
            where: { id: cocktail.id },
            relations: ['ingredients', 'ingredients.ingredient', 'user'],
        });
        if (!completeCocktail) {
            throw new common_1.InternalServerErrorException('Failed to retrieve created cocktail');
        }
        return completeCocktail;
    }
    async prepare(cocktailId, userId) {
        return await this.cocktailRepository.manager.transaction(async (transactionalEntityManager) => {
            const cocktail = await transactionalEntityManager.findOne(cocktail_entity_1.Cocktail, {
                where: { id: cocktailId },
                relations: ['ingredients', 'ingredients.ingredient'],
            });
            if (!cocktail) {
                throw new common_1.NotFoundException(`Cocktail #${cocktailId} not found`);
            }
            const inventory = await transactionalEntityManager.find(user_inventory_entity_1.UserInventory, {
                where: { user: { id: userId } },
                relations: ['ingredient'],
            });
            for (const req of cocktail.ingredients) {
                if (!req.ingredient || !req.ingredient.id) {
                    throw new common_1.InternalServerErrorException('Cocktail recipe is corrupt: Missing ingredient data.');
                }
                const stock = inventory.find(i => i.ingredient && i.ingredient.id === req.ingredient.id);
                if (!stock || !this.unitConverter.hasEnoughStock(stock.quantity, stock.unit, req.amount, req.unit, req.ingredient)) {
                    throw new common_1.BadRequestException(`Not enough stock for ingredient: ${req.ingredient.name || 'Unknown'}`);
                }
            }
            for (const req of cocktail.ingredients) {
                const stock = inventory.find(i => i.ingredient.id === req.ingredient.id);
                if (stock) {
                    const amountToSubtract = this.unitConverter.convert(req.amount, req.unit, stock.unit, req.ingredient);
                    const currentQty = stock.quantity instanceof decimal_js_1.Decimal
                        ? stock.quantity
                        : new decimal_js_1.Decimal(stock.quantity || 0);
                    stock.quantity = currentQty.minus(amountToSubtract);
                    await transactionalEntityManager.save(stock);
                }
            }
            return { message: `Cocktail ${cocktail.name} prepared successfully!` };
        });
    }
    async findAll(paginationQuery) {
        const { limit = 10, page = 1 } = paginationQuery;
        const offset = (page - 1) * limit;
        const [data, total] = await this.cocktailRepository.findAndCount({
            relations: ['ingredients', 'ingredients.ingredient'],
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
        const cocktail = await this.cocktailRepository.findOne({
            where: { id },
            relations: ['ingredients', 'ingredients.ingredient'],
        });
        if (!cocktail)
            throw new common_1.NotFoundException(`Cocktail #${id} not found`);
        return cocktail;
    }
    async update(id, updateCocktailDto, userId) {
        const cocktail = await this.findOne(id);
        if (userId && cocktail.user?.id !== userId) {
            throw new common_1.NotFoundException(`Cocktail #${id} not found or you don't have permission to update it`);
        }
        Object.assign(cocktail, {
            ...updateCocktailDto,
            image_full: updateCocktailDto.imageFull,
            image_thumb: updateCocktailDto.imageThumb,
        });
        return await this.cocktailRepository.save(cocktail);
    }
    async remove(id) {
        const cocktail = await this.findOne(id);
        return await this.cocktailRepository.remove(cocktail);
    }
};
exports.CocktailsService = CocktailsService;
exports.CocktailsService = CocktailsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(cocktail_entity_1.Cocktail)),
    __param(1, (0, typeorm_1.InjectRepository)(cocktail_ingredient_entity_1.CocktailIngredient)),
    __param(2, (0, typeorm_1.InjectRepository)(ingredient_entity_1.Ingredient)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(4, (0, common_1.Inject)((0, common_1.forwardRef)(() => user_inventory_service_1.UserInventoryService))),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        user_inventory_service_1.UserInventoryService,
        unit_converter_service_1.UnitConverterService])
], CocktailsService);
//# sourceMappingURL=cocktails.service.js.map