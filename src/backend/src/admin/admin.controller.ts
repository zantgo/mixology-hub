import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  // Content moderation

  @Get('reports')
  async getReports(@Query() paginationQuery: PaginationQueryDto) {
    return this.adminService.getReports(paginationQuery);
  }

  @Post('reports/:id/review')
  async reviewReport(@Param('id') id: string, @Body() dto: ReviewReportDto) {
    return this.adminService.reviewReport(id, dto.status, dto.reviewedBy);
  }

  // Ingredient merge (UC 1.23)

  @Post('ingredients/merge')
  async mergeIngredients(@Body() dto: MergeIngredientsDto) {
    return this.adminService.mergeIngredients(dto.sourceId, dto.targetId);
  }

  // Ingredient synonym mapping (UC 1.24)

  @Post('ingredients/:id/synonyms')
  async mapSynonym(@Param('id') id: string, @Body('synonym') synonym: string) {
    return this.adminService.mapSynonym(id, synonym);
  }

  // Hidden external cocktails

  @Post('external-cocktails/hide')
  async hideExternalCocktail(@Body() dto: HideExternalCocktailDto) {
    return this.adminService.hideExternalCocktail(
      dto.externalId,
      dto.reason,
      dto.adminId,
    );
  }

  @Delete('external-cocktails/:externalId/hide')
  async unhideExternalCocktail(@Param('externalId') externalId: string) {
    return this.adminService.unhideExternalCocktail(externalId);
  }

  // Ingredient promotion

  @Post('ingredients/:id/promote')
  async promoteIngredient(@Param('id') id: string) {
    return this.adminService.promoteIngredient(id);
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

  @Post('security/global-revoke')
  @ApiOperation({
    summary:
      'Globally revoke all sessions with mandatory security audit logging',
  })
  async globalRevoke(@Req() req: any, @Body('reason') reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException(
        'Security audit mandate: A revocation reason is required.',
      );
    }
    const adminId = req.user.id;
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';

    return this.authService.revokeAllSessions(adminId, clientIp, reason);
  }
}
