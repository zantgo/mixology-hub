import { Controller, Post, Delete, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ReviewReportDto } from './dto/review-report.dto';
import { MergeIngredientsDto } from './dto/merge-ingredients.dto';
import { HideExternalCocktailDto } from './dto/hide-external-cocktail.dto';
import { SetSettingDto } from './dto/set-setting.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Content moderation

  @Get('reports')
  async getReports(@Query() paginationQuery: PaginationQueryDto) {
    return this.adminService.getReports(paginationQuery);
  }

  @Post('reports/:id/review')
  async reviewReport(
    @Param('id') id: string,
    @Body() dto: ReviewReportDto,
  ) {
    return this.adminService.reviewReport(id, dto.status, dto.reviewedBy);
  }

  // Ingredient merge (UC 1.23)

  @Post('ingredients/merge')
  async mergeIngredients(@Body() dto: MergeIngredientsDto) {
    return this.adminService.mergeIngredients(dto.sourceId, dto.targetId, dto.adminId);
  }

  // Hidden external cocktails

  @Post('external-cocktails/hide')
  async hideExternalCocktail(@Body() dto: HideExternalCocktailDto) {
    return this.adminService.hideExternalCocktail(dto.externalId, dto.reason, dto.adminId);
  }

  @Delete('external-cocktails/:externalId/hide')
  async unhideExternalCocktail(@Param('externalId') externalId: string) {
    return this.adminService.unhideExternalCocktail(externalId);
  }

  // System settings

  @Get('settings/:key')
  async getSetting(@Param('key') key: string) {
    return this.adminService.getSetting(key);
  }

  @Post('settings')
  async setSetting(@Body() dto: SetSettingDto) {
    return this.adminService.setSetting(dto.key, dto.value, dto.updatedBy);
  }
}
