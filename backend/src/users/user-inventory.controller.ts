import { Controller, Get, Post, Body, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserInventoryService } from './user-inventory.service';
import { AddInventoryDto } from './dto/add-inventory.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('User Inventory')
@Controller('user-inventory')
export class UserInventoryController {
  constructor(private readonly inventoryService: UserInventoryService) {}

  @Post()
  @ApiOperation({ summary: 'Add ingredient to user inventory' })
  add(@Body() dto: AddInventoryDto) {
    return this.inventoryService.addToInventory(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get current user inventory with pagination' })
  findAll(@Query() paginationQuery: PaginationQueryDto) {
    return this.inventoryService.getUserInventory(paginationQuery);
  }

  @Get('makeable')
  @ApiOperation({ summary: 'Get cocktails the user can make based on inventory (paginated)' })
  getMakeableCocktails(@Query() paginationQuery: PaginationQueryDto) {
    return this.inventoryService.getMakeableCocktails(paginationQuery);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove ingredient from inventory' })
  remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }
}
