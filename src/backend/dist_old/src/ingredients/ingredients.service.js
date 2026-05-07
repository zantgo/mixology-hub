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
exports.IngredientsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ingredient_entity_1 = require("./entities/ingredient.entity");
let IngredientsService = class IngredientsService {
    ingredientRepository;
    constructor(ingredientRepository) {
        this.ingredientRepository = ingredientRepository;
    }
    async create(createIngredientDto) {
        try {
            const ingredient = this.ingredientRepository.create({
                name: createIngredientDto.name.toLowerCase().trim(),
                baseUnit: createIngredientDto.baseUnit || 'ml',
            });
            return await this.ingredientRepository.save(ingredient);
        }
        catch (error) {
            if (error?.code === '23505')
                throw new common_1.ConflictException('Ingredient already exists');
            throw error;
        }
    }
    async findAll(paginationQuery) {
        const { limit = 10, page = 1 } = paginationQuery;
        const offset = (page - 1) * limit;
        const [data, total] = await this.ingredientRepository.findAndCount({
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
        const ingredient = await this.ingredientRepository.findOne({ where: { id } });
        if (!ingredient)
            throw new common_1.NotFoundException(`Ingredient with ID ${id} not found`);
        return ingredient;
    }
    async update(id, updateIngredientDto) {
        const ingredient = await this.findOne(id);
        Object.assign(ingredient, updateIngredientDto);
        return await this.ingredientRepository.save(ingredient);
    }
    async remove(id) {
        const ingredient = await this.findOne(id);
        return await this.ingredientRepository.remove(ingredient);
    }
};
exports.IngredientsService = IngredientsService;
exports.IngredientsService = IngredientsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ingredient_entity_1.Ingredient)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], IngredientsService);
//# sourceMappingURL=ingredients.service.js.map