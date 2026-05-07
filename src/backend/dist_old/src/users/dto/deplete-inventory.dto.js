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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepleteInventoryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const check_makeability_dto_1 = require("./check-makeability.dto");
class DepleteInventoryDto {
    ingredients;
}
exports.DepleteInventoryDto = DepleteInventoryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [check_makeability_dto_1.RecipeIngredientDto], description: 'Ingredients to deplete from inventory' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => check_makeability_dto_1.RecipeIngredientDto),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Array)
], DepleteInventoryDto.prototype, "ingredients", void 0);
//# sourceMappingURL=deplete-inventory.dto.js.map