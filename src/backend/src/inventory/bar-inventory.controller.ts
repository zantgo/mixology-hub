import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { BarInventoryService } from './bar-inventory.service';
import { MakeabilityService } from './makeability.service';
import { AddBarInventoryDto } from './dto/add-bar-inventory.dto';
import { UpdateBarInventoryDto } from './dto/update-bar-inventory.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';

interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  token: string;
}

@ApiTags('Bar Inventory')
@ApiBearerAuth()
@Controller('bar-inventory')
@UseGuards(JwtAuthGuard)
export class BarInventoryController {
  constructor(
    private readonly inventoryService: BarInventoryService,
    private readonly makeabilityService: MakeabilityService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get bar inventory (all authenticated users)' })
  getInventory(@Query() paginationQuery: PaginationQueryDto) {
    return this.inventoryService.getInventory(paginationQuery);
  }

  @Get('makeable')
  @ApiOperation({
    summary:
      'List cocktails with makeability status based on current inventory',
  })
  getMakeable(@Query() paginationQuery: PaginationQueryDto) {
    return this.makeabilityService.getMakeableCocktails(paginationQuery);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single inventory item' })
  getInventoryItem(@Param('id') id: string) {
    return this.inventoryService.getInventoryItem(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Add stock to bar inventory (ADMIN ONLY)' })
  addToInventory(
    @Body() dto: AddBarInventoryDto,
    @GetUser() _user: AuthenticatedUser,
  ) {
    return this.inventoryService.addToInventory(dto);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update inventory item (ADMIN ONLY)' })
  updateInventoryItem(
    @Param('id') id: string,
    @Body() dto: UpdateBarInventoryDto,
  ) {
    return this.inventoryService.updateInventoryItem(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove inventory item (ADMIN ONLY)' })
  removeFromInventory(@Param('id') id: string) {
    return this.inventoryService.removeFromInventory(id);
  }

  @Post('bulk')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Bulk add stock (ADMIN ONLY)' })
  bulkAdd(@Body() dtos: AddBarInventoryDto[]) {
    return this.inventoryService.bulkAdd(dtos);
  }

  @Delete('bulk')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Bulk delete inventory items (ADMIN ONLY)' })
  bulkDelete(@Body() ids: string[]) {
    return this.inventoryService.bulkDelete(ids);
  }
}
