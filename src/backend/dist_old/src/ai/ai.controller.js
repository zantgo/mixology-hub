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
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("./ai.service");
const create_ai_dto_1 = require("./dto/create-ai.dto");
const update_ai_dto_1 = require("./dto/update-ai.dto");
const save_ai_recipe_dto_1 = require("./dto/save-ai-recipe.dto");
const swagger_1 = require("@nestjs/swagger");
const pagination_query_dto_1 = require("../common/dto/pagination-query.dto");
let AiController = class AiController {
    aiService;
    constructor(aiService) {
        this.aiService = aiService;
    }
    create(createAiDto) {
        return this.aiService.generateRecipe(createAiDto);
    }
    saveAsCocktail(id, saveDto) {
        return this.aiService.saveAsCocktail(id, saveDto);
    }
    findAll(paginationQuery) {
        return this.aiService.findAll(paginationQuery);
    }
    findOne(id) {
        return this.aiService.findOne(id);
    }
    update(id, updateAiDto) {
        return this.aiService.update(id, updateAiDto);
    }
    remove(id) {
        return this.aiService.remove(id);
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Generate a new cocktail recipe using AI' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_ai_dto_1.CreateAiDto]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/save-as-cocktail'),
    (0, swagger_1.ApiOperation)({ summary: 'Save an AI generated recipe into your local cocktail collection' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, save_ai_recipe_dto_1.SaveAiRecipeDto]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "saveAsCocktail", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get history of AI generated recipes for the user with pagination' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_query_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific AI generated recipe by ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update an AI generated recipe' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_ai_dto_1.UpdateAiDto]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete an AI generated recipe from history' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "remove", null);
exports.AiController = AiController = __decorate([
    (0, swagger_1.ApiTags)('AI'),
    (0, common_1.Controller)('ai'),
    __metadata("design:paramtypes", [ai_service_1.AiService])
], AiController);
//# sourceMappingURL=ai.controller.js.map