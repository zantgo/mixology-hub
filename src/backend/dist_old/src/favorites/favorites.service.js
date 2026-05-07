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
exports.FavoritesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const favorite_entity_1 = require("./entities/favorite.entity");
const user_entity_1 = require("../users/entities/user.entity");
let FavoritesService = class FavoritesService {
    favoriteRepository;
    userRepository;
    constructor(favoriteRepository, userRepository) {
        this.favoriteRepository = favoriteRepository;
        this.userRepository = userRepository;
    }
    async create(dto) {
        const user = await this.userRepository.findOne({ where: { email: 'mock@test.com' } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const favorite = this.favoriteRepository.create({
            user: user,
            cocktail: dto.cocktailId ? { id: dto.cocktailId } : undefined,
            external_cocktail_id: dto.externalCocktailId || undefined,
        });
        return await this.favoriteRepository.save(favorite);
    }
    async findAll(paginationQuery) {
        const user = await this.userRepository.findOne({ where: { email: 'mock@test.com' } });
        const { limit = 10, page = 1 } = paginationQuery;
        const offset = (page - 1) * limit;
        const [data, total] = await this.favoriteRepository.findAndCount({
            where: { user: { id: user?.id } },
            relations: ['cocktail'],
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
        const favorite = await this.favoriteRepository.findOne({
            where: { id },
            relations: ['user', 'cocktail']
        });
        if (!favorite) {
            throw new common_1.NotFoundException(`Favorite with ID ${id} not found`);
        }
        return favorite;
    }
    async update(id, updateFavoriteDto) {
        const favorite = await this.findOne(id);
        if (updateFavoriteDto.cocktailId !== undefined) {
            favorite.cocktail = updateFavoriteDto.cocktailId ? { id: updateFavoriteDto.cocktailId } : null;
        }
        if (updateFavoriteDto.externalCocktailId !== undefined) {
            favorite.external_cocktail_id = updateFavoriteDto.externalCocktailId || null;
        }
        return await this.favoriteRepository.save(favorite);
    }
    async remove(id) {
        const favorite = await this.findOne(id);
        return await this.favoriteRepository.remove(favorite);
    }
};
exports.FavoritesService = FavoritesService;
exports.FavoritesService = FavoritesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(favorite_entity_1.Favorite)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], FavoritesService);
//# sourceMappingURL=favorites.service.js.map