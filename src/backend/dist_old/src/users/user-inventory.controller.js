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
exports.UserInventoryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const user_inventory_service_1 = require("./user-inventory.service");
const add_inventory_dto_1 = require("./dto/add-inventory.dto");
const pagination_query_dto_1 = require("../common/dto/pagination-query.dto");
const check_makeability_dto_1 = require("./dto/check-makeability.dto");
const deplete_inventory_dto_1 = require("./dto/deplete-inventory.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let UserInventoryController = class UserInventoryController {
    inventoryService;
    constructor(inventoryService) {
        this.inventoryService = inventoryService;
    }
    add(req, dto) {
        return this.inventoryService.addToInventory(req.user.id, dto);
    }
    findAll(req) {
        return this.inventoryService.getInventory(req.user.id);
    }
    getSummary(req) {
        return this.inventoryService.getInventorySummary(req.user.id);
    }
    getMakeableCocktails(req, paginationQuery) {
        return this.inventoryService.getMakeableCocktails(req.user.id, paginationQuery);
    }
    checkMakeability(req, dto) {
        return this.inventoryService.checkMakeability(req.user.id, dto);
    }
    depleteInventory(req, dto) {
        return this.inventoryService.depleteInventory(req.user.id, dto);
    }
    update(req, id, quantity, unit) {
        return this.inventoryService.updateInventoryItem(req.user.id, id, quantity, unit);
    }
    remove(req, id) {
        return this.inventoryService.removeFromInventory(req.user.id, id);
    }
};
exports.UserInventoryController = UserInventoryController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Add ingredient to user inventory' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, add_inventory_dto_1.AddInventoryDto]),
    __metadata("design:returntype", void 0)
], UserInventoryController.prototype, "add", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user inventory' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UserInventoryController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, swagger_1.ApiOperation)({ summary: 'Get inventory summary (total items, volume, low stock)' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UserInventoryController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('makeable'),
    (0, swagger_1.ApiOperation)({ summary: 'Get cocktails the user can make based on inventory (paginated)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_query_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], UserInventoryController.prototype, "getMakeableCocktails", null);
__decorate([
    (0, common_1.Post)('check-makeability'),
    (0, swagger_1.ApiOperation)({ summary: 'Check if a recipe is makeable with current inventory' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, check_makeability_dto_1.CheckMakeabilityDto]),
    __metadata("design:returntype", void 0)
], UserInventoryController.prototype, "checkMakeability", null);
__decorate([
    (0, common_1.Post)('deplete'),
    (0, swagger_1.ApiOperation)({ summary: 'Deplete inventory after making a cocktail (transactional)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, deplete_inventory_dto_1.DepleteInventoryDto]),
    __metadata("design:returntype", void 0)
], UserInventoryController.prototype, "depleteInventory", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update inventory item quantity' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('quantity')),
    __param(3, (0, common_1.Body)('unit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number, String]),
    __metadata("design:returntype", void 0)
], UserInventoryController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Remove ingredient from inventory' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], UserInventoryController.prototype, "remove", null);
exports.UserInventoryController = UserInventoryController = __decorate([
    (0, swagger_1.ApiTags)('User Inventory'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('user-inventory'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [user_inventory_service_1.UserInventoryService])
], UserInventoryController);
//# sourceMappingURL=user-inventory.controller.js.map