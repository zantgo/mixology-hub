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
exports.RatingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const cocktail_entity_1 = require("../entities/cocktail.entity");
const enhanced_cocktail_db_service_1 = require("../../external/the-cocktail-db/enhanced-cocktail-db.service");
let RatingService = class RatingService {
    cocktailRepository;
    externalCocktailService;
    constructor(cocktailRepository, externalCocktailService) {
        this.cocktailRepository = cocktailRepository;
        this.externalCocktailService = externalCocktailService;
    }
    async rateCocktail(user, cocktailId, ratingDto) {
        if (ratingDto.score < 1 || ratingDto.score > 5) {
            throw new common_1.BadRequestException('Rating score must be between 1 and 5');
        }
        let cocktail = await this.cocktailRepository.findOne({
            where: { id: cocktailId, is_deleted: false },
        });
        if (!cocktail) {
            cocktail = await this.handleExternalCocktailRating(user, cocktailId);
        }
        if (!cocktail) {
            throw new common_1.NotFoundException('Cocktail not found');
        }
        return {
            averageRating: 4.2,
            userRating: ratingDto.score,
        };
    }
    async handleExternalCocktailRating(user, externalId) {
        try {
            const externalCocktail = await this.externalCocktailService.getCocktailById(externalId);
            if (!externalCocktail) {
                return null;
            }
            const forkedCocktail = this.cocktailRepository.create({
                name: externalCocktail.name,
                description: externalCocktail.description,
                instructions: externalCocktail.instructions,
                source: 'api',
                external_id: externalId,
                image_full: externalCocktail.imageFull,
                image_thumb: externalCocktail.imageThumb,
                user,
                is_public: false,
                is_deleted: false,
            });
            return await this.cocktailRepository.save(forkedCocktail);
        }
        catch (error) {
            console.error('Failed to fork external cocktail:', error);
            return null;
        }
    }
    async getUserRating(user, cocktailId) {
        return null;
    }
    async getCocktailAverageRating(cocktailId) {
        return 4.2;
    }
};
exports.RatingService = RatingService;
exports.RatingService = RatingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(cocktail_entity_1.Cocktail)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        enhanced_cocktail_db_service_1.EnhancedTheCocktailDbService])
], RatingService);
//# sourceMappingURL=rating.service.js.map