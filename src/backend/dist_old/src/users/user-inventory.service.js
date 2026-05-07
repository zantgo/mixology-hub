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
exports.UserInventoryService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const decimal_js_1 = require("decimal.js");
const user_inventory_entity_1 = require("./entities/user-inventory.entity");
const users_service_1 = require("./users.service");
const ingredient_entity_1 = require("../ingredients/entities/ingredient.entity");
const cocktail_entity_1 = require("../cocktails/entities/cocktail.entity");
const unit_converter_service_1 = require("../utils/unit-converter.service");
const hierarchical_ingredient_service_1 = require("../ingredients/hierarchical-ingredient.service");
let UserInventoryService = class UserInventoryService {
    inventoryRepository;
    ingredientRepository;
    cocktailRepository;
    usersService;
    unitConverter;
    hierarchicalIngredientService;
    dataSource;
    MAX_ITERATIONS = 200;
    constructor(inventoryRepository, ingredientRepository, cocktailRepository, usersService, unitConverter, hierarchicalIngredientService, dataSource) {
        this.inventoryRepository = inventoryRepository;
        this.ingredientRepository = ingredientRepository;
        this.cocktailRepository = cocktailRepository;
        this.usersService = usersService;
        this.unitConverter = unitConverter;
        this.hierarchicalIngredientService = hierarchicalIngredientService;
        this.dataSource = dataSource;
    }
    async addToInventory(userId, dto) {
        const ingredient = await this.ingredientRepository.findOne({ where: { id: dto.ingredientId } });
        if (!ingredient)
            throw new common_1.NotFoundException('Ingredient not found');
        let quantityToStore = dto.quantity;
        if (dto.unit !== ingredient.baseUnit) {
            try {
                quantityToStore = this.unitConverter.convert(dto.quantity, dto.unit, ingredient.baseUnit, ingredient);
            }
            catch (error) {
                throw new common_1.BadRequestException(`Cannot convert ${dto.quantity} ${dto.unit} to ${ingredient.baseUnit}: ${error.message}`);
            }
        }
        let inventoryItem = await this.inventoryRepository.findOne({
            where: { user: { id: userId }, ingredient: { id: ingredient.id } },
            relations: ['ingredient'],
        });
        if (inventoryItem) {
            const currentQty = inventoryItem.quantity instanceof decimal_js_1.Decimal
                ? inventoryItem.quantity
                : new decimal_js_1.Decimal(inventoryItem.quantity || 0);
            const addQty = quantityToStore instanceof decimal_js_1.Decimal
                ? quantityToStore
                : new decimal_js_1.Decimal(quantityToStore);
            inventoryItem.quantity = currentQty.plus(addQty);
            inventoryItem.unit = ingredient.baseUnit;
        }
        else {
            inventoryItem = this.inventoryRepository.create({
                user: { id: userId },
                ingredient,
                quantity: quantityToStore,
                unit: ingredient.baseUnit,
            });
        }
        return await this.inventoryRepository.save(inventoryItem);
    }
    async getInventory(userId) {
        return await this.inventoryRepository.find({
            where: { user: { id: userId } },
            relations: ['ingredient', 'ingredient.parent'],
            order: { ingredient: { name: 'ASC' } },
        });
    }
    async removeFromInventory(userId, inventoryItemId) {
        const item = await this.inventoryRepository.findOne({
            where: { id: inventoryItemId, user: { id: userId } },
        });
        if (!item)
            throw new common_1.NotFoundException('Inventory item not found');
        return await this.inventoryRepository.remove(item);
    }
    async updateInventoryItem(userId, inventoryItemId, quantity, unit) {
        const item = await this.inventoryRepository.findOne({
            where: { id: inventoryItemId, user: { id: userId } },
            relations: ['ingredient'],
        });
        if (!item)
            throw new common_1.NotFoundException('Inventory item not found');
        let quantityToStore = quantity;
        if (unit !== item.ingredient.baseUnit) {
            try {
                quantityToStore = this.unitConverter.convert(quantity, unit, item.ingredient.baseUnit, item.ingredient);
            }
            catch (error) {
                throw new common_1.BadRequestException(`Cannot convert ${quantity} ${unit} to ${item.ingredient.baseUnit}: ${error.message}`);
            }
        }
        item.quantity = quantityToStore instanceof decimal_js_1.Decimal ? quantityToStore : new decimal_js_1.Decimal(quantityToStore);
        item.unit = item.ingredient.baseUnit;
        return await this.inventoryRepository.save(item);
    }
    async checkMakeability(userId, dto) {
        const inventory = await this.getInventory(userId);
        const missingIngredients = [];
        const substitutions = [];
        for (const required of dto.ingredients) {
            const requiredIngredient = await this.ingredientRepository.findOne({
                where: { id: required.ingredientId },
                relations: ['parent'],
            });
            if (!requiredIngredient) {
                throw new common_1.NotFoundException(`Ingredient ${required.ingredientId} not found`);
            }
            const matchingInventory = await this.findMatchingInventoryItem(inventory, requiredIngredient, required.amount, required.unit);
            if (!matchingInventory) {
                missingIngredients.push({
                    ingredientId: required.ingredientId,
                    ingredientName: requiredIngredient.name,
                    requiredAmount: required.amount,
                    requiredUnit: required.unit,
                    availableAmount: 0,
                    availableUnit: required.unit,
                    missingAmount: required.amount,
                });
            }
            else if (matchingInventory.isSubstitution) {
                substitutions.push({
                    requiredIngredientId: required.ingredientId,
                    requiredIngredientName: requiredIngredient.name,
                    substitutedWithId: matchingInventory.item.ingredient.id,
                    substitutedWithName: matchingInventory.item.ingredient.name,
                });
            }
        }
        return {
            isMakeable: missingIngredients.length === 0,
            missingIngredients,
            substitutions,
        };
    }
    async findMatchingInventoryItem(inventory, requiredIngredient, requiredAmount, requiredUnit) {
        const directMatch = inventory.find(item => item.ingredient.id === requiredIngredient.id);
        if (directMatch) {
            const hasEnough = this.unitConverter.hasEnoughStock(directMatch.quantity, directMatch.unit, requiredAmount, requiredUnit, requiredIngredient);
            if (hasEnough) {
                return { item: directMatch, isSubstitution: false };
            }
        }
        const substitutions = await this.hierarchicalIngredientService.findSubstitutions(requiredIngredient.id, { maxSubstitutions: 10, minConfidence: 0.7 });
        for (const substitution of substitutions) {
            const substitutionMatch = inventory.find(item => item.ingredient.id === substitution.substitute.id);
            if (substitutionMatch) {
                const hasEnough = this.unitConverter.hasEnoughStock(substitutionMatch.quantity, substitutionMatch.unit, requiredAmount, requiredUnit, requiredIngredient);
                if (hasEnough) {
                    return {
                        item: substitutionMatch,
                        isSubstitution: true
                    };
                }
            }
        }
        return null;
    }
    async depleteInventory(userId, dto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const inventory = await queryRunner.manager.find(user_inventory_entity_1.UserInventory, {
                where: { user: { id: userId } },
                relations: ['ingredient'],
            });
            const missingIngredients = [];
            for (const required of dto.ingredients) {
                const requiredIngredient = await queryRunner.manager.findOne(ingredient_entity_1.Ingredient, {
                    where: { id: required.ingredientId },
                    relations: ['parent'],
                });
                if (!requiredIngredient) {
                    throw new common_1.NotFoundException(`Ingredient ${required.ingredientId} not found`);
                }
                const matchingInventory = await this.findMatchingInventoryItem(inventory, requiredIngredient, required.amount, required.unit);
                if (!matchingInventory) {
                    missingIngredients.push({
                        ingredientId: required.ingredientId,
                        ingredientName: requiredIngredient.name,
                        requiredAmount: required.amount,
                        requiredUnit: required.unit,
                        availableAmount: 0,
                        availableUnit: required.unit,
                        missingAmount: required.amount,
                    });
                }
            }
            if (missingIngredients.length > 0) {
                throw new common_1.BadRequestException('Cannot deplete inventory: missing ingredients', {
                    cause: missingIngredients,
                });
            }
            const depletedItems = [];
            for (const required of dto.ingredients) {
                const requiredIngredient = await queryRunner.manager.findOne(ingredient_entity_1.Ingredient, {
                    where: { id: required.ingredientId },
                });
                if (!requiredIngredient) {
                    throw new common_1.NotFoundException(`Ingredient ${required.ingredientId} not found`);
                }
                const matchingInventory = await this.findMatchingInventoryItem(inventory, requiredIngredient, required.amount, required.unit);
                if (!matchingInventory) {
                    throw new common_1.InternalServerErrorException('Inventory item not found despite makeability check');
                }
                const amountToDeplete = this.unitConverter.convert(required.amount, required.unit, matchingInventory.item.unit, requiredIngredient);
                const currentQty = matchingInventory.item.quantity instanceof decimal_js_1.Decimal
                    ? matchingInventory.item.quantity
                    : new decimal_js_1.Decimal(matchingInventory.item.quantity || 0);
                let newQuantity = currentQty.minus(amountToDeplete);
                if (matchingInventory.item.ingredient.baseUnit === 'count') {
                    newQuantity = new decimal_js_1.Decimal(Math.floor(newQuantity.toNumber()));
                }
                const depletedAmount = amountToDeplete instanceof decimal_js_1.Decimal
                    ? amountToDeplete.toNumber()
                    : amountToDeplete;
                if (newQuantity.lte(0)) {
                    await queryRunner.manager.remove(user_inventory_entity_1.UserInventory, matchingInventory.item);
                }
                else {
                    matchingInventory.item.quantity = newQuantity;
                    await queryRunner.manager.save(user_inventory_entity_1.UserInventory, matchingInventory.item);
                }
                depletedItems.push({
                    ingredientId: matchingInventory.item.ingredient.id,
                    amountDepleted: depletedAmount,
                });
            }
            await queryRunner.commitTransaction();
            return { success: true, depletedItems };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async getMakeableCocktails(userId, paginationQuery) {
        const inventory = await this.getInventory(userId);
        if (inventory.length === 0) {
            const { limit = 10, page = 1 } = paginationQuery;
            return {
                data: [],
                meta: {
                    currentPage: page,
                    nextPage: null,
                    itemsPerPage: limit,
                    totalItems: 0,
                    totalPages: 0
                }
            };
        }
        const allCocktails = await this.cocktailRepository.find({
            relations: ['ingredients', 'ingredients.ingredient'],
            where: { is_public: true },
        });
        const { limit = 10, page = 1 } = paginationQuery;
        const offset = (page - 1) * limit;
        const targetCount = offset + limit;
        const makeableCocktails = [];
        let iterations = 0;
        for (const cocktail of allCocktails) {
            if (iterations >= this.MAX_ITERATIONS) {
                break;
            }
            iterations++;
            let isMakeable = true;
            for (const cocktailIngredient of cocktail.ingredients) {
                const matchingInventory = await this.findMatchingInventoryItem(inventory, cocktailIngredient.ingredient, cocktailIngredient.amount instanceof decimal_js_1.Decimal
                    ? cocktailIngredient.amount.toNumber()
                    : cocktailIngredient.amount, cocktailIngredient.unit);
                if (!matchingInventory) {
                    isMakeable = false;
                    break;
                }
            }
            if (isMakeable) {
                makeableCocktails.push(cocktail);
                if (makeableCocktails.length >= targetCount) {
                    break;
                }
            }
        }
        if (iterations >= this.MAX_ITERATIONS && makeableCocktails.length > 0 && makeableCocktails.length <= offset) {
            throw new common_1.BadRequestException('Pagination overshoot: Requested page exceeds available results due to computation limits.', 'PAGINATION_OVERSHOOT');
        }
        const paginatedData = makeableCocktails.slice(offset, offset + limit);
        const totalItems = makeableCocktails.length;
        const totalPages = Math.ceil(totalItems / limit);
        const hasNextPage = page < totalPages;
        return {
            data: paginatedData,
            meta: {
                currentPage: page,
                nextPage: hasNextPage ? page + 1 : null,
                itemsPerPage: limit,
                totalItems,
                totalPages,
                iterations,
                maxIterations: this.MAX_ITERATIONS,
                warning: iterations >= this.MAX_ITERATIONS
                    ? 'Results limited by computation constraints. Try filtering to reduce candidates.'
                    : null,
            }
        };
    }
    async getInventorySummary(userId) {
        const inventory = await this.getInventory(userId);
        const totalItems = inventory.length;
        const totalVolume = inventory.reduce((sum, item) => {
            if (item.ingredient.baseUnit === 'count') {
                const qty = item.quantity instanceof decimal_js_1.Decimal
                    ? item.quantity.toNumber()
                    : Number(item.quantity);
                return sum + qty;
            }
            try {
                const volumeInMl = this.unitConverter.convert(item.quantity, item.unit, 'ml', item.ingredient);
                const volNum = volumeInMl instanceof decimal_js_1.Decimal ? volumeInMl.toNumber() : Number(volumeInMl);
                return sum + volNum;
            }
            catch {
                return sum;
            }
        }, 0);
        const categories = new Set();
        inventory.forEach(item => {
            const name = item.ingredient.name.toLowerCase();
            if (name.includes('vodka') || name.includes('gin') || name.includes('rum') ||
                name.includes('tequila') || name.includes('whiskey') || name.includes('bourbon')) {
                categories.add('Spirits');
            }
            else if (name.includes('juice') || name.includes('soda') || name.includes('tonic')) {
                categories.add('Mixers');
            }
            else if (name.includes('bitters') || name.includes('syrup') || name.includes('vermouth')) {
                categories.add('Modifiers');
            }
            else if (name.includes('fruit') || name.includes('herb') || name.includes('spice')) {
                categories.add('Garnishes');
            }
            else {
                categories.add('Other');
            }
        });
        return {
            totalItems,
            totalVolumeMl: Math.round(totalVolume),
            categories: Array.from(categories),
            lowStockItems: inventory.filter(item => {
                if (item.ingredient.baseUnit === 'count') {
                    const qty = item.quantity instanceof decimal_js_1.Decimal
                        ? item.quantity.toNumber()
                        : Number(item.quantity);
                    return qty < 5;
                }
                try {
                    const volumeInMl = this.unitConverter.convert(item.quantity, item.unit, 'ml', item.ingredient);
                    const volNum = volumeInMl instanceof decimal_js_1.Decimal ? volumeInMl.toNumber() : Number(volumeInMl);
                    return volNum < 100;
                }
                catch {
                    return false;
                }
            }).map(item => ({
                id: item.id,
                ingredientName: item.ingredient.name,
                quantity: item.quantity instanceof decimal_js_1.Decimal ? item.quantity.toNumber() : Number(item.quantity),
                unit: item.unit,
            })),
        };
    }
};
exports.UserInventoryService = UserInventoryService;
exports.UserInventoryService = UserInventoryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_inventory_entity_1.UserInventory)),
    __param(1, (0, typeorm_1.InjectRepository)(ingredient_entity_1.Ingredient)),
    __param(2, (0, typeorm_1.InjectRepository)(cocktail_entity_1.Cocktail)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        users_service_1.UsersService,
        unit_converter_service_1.UnitConverterService,
        hierarchical_ingredient_service_1.HierarchicalIngredientService,
        typeorm_2.DataSource])
], UserInventoryService);
//# sourceMappingURL=user-inventory.service.js.map