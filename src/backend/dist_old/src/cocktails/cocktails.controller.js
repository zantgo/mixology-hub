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
exports.CocktailsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const cocktails_service_1 = require("./cocktails.service");
const cocktail_aggregator_service_1 = require("./cocktail-aggregator.service");
const pagination_query_dto_1 = require("../common/dto/pagination-query.dto");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const user_entity_1 = require("../users/entities/user.entity");
const image_service_1 = require("../images/image.service");
let CocktailsController = class CocktailsController {
    cocktailsService;
    aggregatorService;
    imageService;
    constructor(cocktailsService, aggregatorService, imageService) {
        this.cocktailsService = cocktailsService;
        this.aggregatorService = aggregatorService;
        this.imageService = imageService;
    }
    async create(body, file, user) {
        let createCocktailDto;
        if (body && body.data) {
            try {
                createCocktailDto = JSON.parse(body.data);
            }
            catch (error) {
                throw new common_1.BadRequestException('Invalid JSON data in form field "data"');
            }
        }
        else {
            createCocktailDto = body;
        }
        let imagePaths = { full: null, thumb: null };
        if (file) {
            imagePaths = await this.imageService.processAndSaveImage(file);
        }
        return this.cocktailsService.create({
            ...createCocktailDto,
            imageFull: imagePaths.full || undefined,
            imageThumb: imagePaths.thumb || undefined
        }, user.id);
    }
    prepare(id, user) {
        return this.cocktailsService.prepare(id, user.id);
    }
    async findAll(paginationQuery, name) {
        if (name) {
            return this.aggregatorService.searchUnified(name, paginationQuery);
        }
        return this.cocktailsService.findAll(paginationQuery);
    }
    findOne(id) {
        return this.cocktailsService.findOne(id);
    }
    async update(id, body, file, user) {
        let updateCocktailDto;
        if (body && body.data) {
            try {
                updateCocktailDto = JSON.parse(body.data);
            }
            catch (error) {
                throw new common_1.BadRequestException('Invalid JSON data in form field "data"');
            }
        }
        else {
            updateCocktailDto = body;
        }
        let imagePaths = { full: null, thumb: null };
        if (file) {
            imagePaths = await this.imageService.processAndSaveImage(file);
        }
        return this.cocktailsService.update(id, {
            ...updateCocktailDto,
            imageFull: imagePaths.full || undefined,
            imageThumb: imagePaths.thumb || undefined
        }, user.id);
    }
    remove(id) {
        return this.cocktailsService.remove(id);
    }
};
exports.CocktailsController = CocktailsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new personal cocktail recipe' }),
    (0, swagger_1.ApiConsumes)('application/json', 'multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('image', {
        limits: { fileSize: 2 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            if (file && file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
                cb(null, true);
            }
            else if (file) {
                cb(new Error('Only JPG, PNG, and WebP are allowed'), false);
            }
            else {
                cb(null, true);
            }
        }
    })),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, user_entity_1.User]),
    __metadata("design:returntype", Promise)
], CocktailsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/prepare'),
    (0, swagger_1.ApiOperation)({ summary: 'Prepare a cocktail and deplete inventory' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_1.User]),
    __metadata("design:returntype", void 0)
], CocktailsController.prototype, "prepare", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List cocktails with pagination. Supports unified external search.' }),
    (0, swagger_1.ApiQuery)({ name: 'name', required: false, description: 'Search term for unified search' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Query)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_query_dto_1.PaginationQueryDto, String]),
    __metadata("design:returntype", Promise)
], CocktailsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get local cocktail by ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CocktailsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a personal cocktail recipe' }),
    (0, swagger_1.ApiConsumes)('application/json', 'multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('image', {
        limits: { fileSize: 2 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            if (file && file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
                cb(null, true);
            }
            else if (file) {
                cb(new Error('Only JPG, PNG, and WebP are allowed'), false);
            }
            else {
                cb(null, true);
            }
        }
    })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, user_entity_1.User]),
    __metadata("design:returntype", Promise)
], CocktailsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a personal cocktail recipe' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CocktailsController.prototype, "remove", null);
exports.CocktailsController = CocktailsController = __decorate([
    (0, swagger_1.ApiTags)('Cocktails'),
    (0, common_1.Controller)('cocktails'),
    __metadata("design:paramtypes", [cocktails_service_1.CocktailsService,
        cocktail_aggregator_service_1.CocktailAggregatorService,
        image_service_1.ImageService])
], CocktailsController);
//# sourceMappingURL=cocktails.controller.js.map