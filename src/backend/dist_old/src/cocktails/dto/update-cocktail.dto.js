"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCocktailDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_cocktail_dto_1 = require("./create-cocktail.dto");
class UpdateCocktailDto extends (0, mapped_types_1.PartialType)(create_cocktail_dto_1.CreateCocktailDto) {
}
exports.UpdateCocktailDto = UpdateCocktailDto;
//# sourceMappingURL=update-cocktail.dto.js.map