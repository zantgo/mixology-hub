"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateFavoriteDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_favorite_dto_1 = require("./create-favorite.dto");
class UpdateFavoriteDto extends (0, mapped_types_1.PartialType)(create_favorite_dto_1.CreateFavoriteDto) {
}
exports.UpdateFavoriteDto = UpdateFavoriteDto;
//# sourceMappingURL=update-favorite.dto.js.map