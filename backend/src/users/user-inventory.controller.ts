import { Controller, Get, Post, Body, Param, Delete, Query, Put, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserInventoryService } from './user-inventory.service';
import { AddInventoryDto } from './dto/add-inventory.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CheckMakeabilityDto } from './dto/check-makeability.dto';
import { DepleteInventoryDto } from './dto/deplete-inventory.dto';
// BulkSyncDto removed as part of Online-Only Mandate
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('User Inventory')
@ApiBearerAuth()
@Controller('user-inventory')
@UseGuards(JwtAuthGuard)
export class UserInventoryController {
  constructor(private readonly inventoryService: UserInventoryService) {}

  @Post()
  @ApiOperation({ summary: 'Add ingredient to user inventory' })
  add(@Request() req, @Body() dto: AddInventoryDto) {
    return this.inventoryService.addToInventory(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get current user inventory with pagination' })
  findAll(@Request() req, @Query() paginationQuery: PaginationQueryDto) {
    return this.inventoryService.getInventory(req.user.id, paginationQuery);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get inventory summary (total items, volume, low stock)' })
  getSummary(@Request() req) {
    return this.inventoryService.getInventorySummary(req.user.id);
  }

  @Get('makeable')
  @ApiOperation({ summary: 'Get cocktails the user can make based on inventory (paginated)' })
  getMakeableCocktails(@Request() req, @Query() paginationQuery: PaginationQueryDto) {
    return this.inventoryService.getMakeableCocktails(req.user.id, paginationQuery);
  }

  @Post('check-makeability')
  @ApiOperation({ summary: 'Check if a recipe is makeable with current inventory' })
  checkMakeability(@Request() req, @Body() dto: CheckMakeabilityDto) {
    return this.inventoryService.checkMakeability(req.user.id, dto);
  }

  @Post('deplete')
  @ApiOperation({ summary: 'Deplete inventory after making a cocktail (transactional)' })
  depleteInventory(@Request() req, @Body() dto: DepleteInventoryDto) {
    return this.inventoryService.depleteInventory(req.user.id, dto);
  }

  // Offline sync endpoint removed as part of Online-Only Mandate

  @Put(':id')
  @ApiOperation({ summary: 'Update inventory item quantity' })
  update(
    @Request() req,
    @Param('id') id: string,
    @Body('quantity') quantity: number,
    @Body('unit') unit: string,
  ) {
    return this.inventoryService.updateInventoryItem(req.user.id, id, quantity, unit);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove ingredient from inventory' })
  remove(@Request() req, @Param('id') id: string) {
    return this.inventoryService.removeFromInventory(req.user.id, id);
  }
}
