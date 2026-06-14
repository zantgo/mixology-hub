import {
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { GdprDataRetentionService } from './gdpr-data-retention.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

interface AuthenticatedRequest extends ExpressRequest {
  user: { id: string; [key: string]: unknown };
}

@ApiTags('GDPR')
@ApiBearerAuth()
@Controller('gdpr')
export class GdprController {
  constructor(private readonly gdprService: GdprDataRetentionService) {}

  @Get('export-data')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Export all user data (GDPR right to access)' })
  @ApiResponse({ status: 200, description: 'User data exported successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async exportUserData(@Request() req: AuthenticatedRequest) {
    const data = await this.gdprService.exportUserData(req.user.id);
    return {
      success: true,
      data,
      exportedAt: new Date().toISOString(),
    };
  }

  @Post('request-deletion')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Request account deletion (GDPR right to be forgotten)',
  })
  @ApiResponse({ status: 202, description: 'Deletion request accepted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async requestAccountDeletion(@Request() req: AuthenticatedRequest) {
    const success = await this.gdprService.deleteUserAccount(req.user.id);

    return {
      success,
      message: success
        ? 'Your account and all associated data have been deleted.'
        : 'Failed to delete account. Please contact support.',
      deletedAt: new Date().toISOString(),
    };
  }

  @Get('retention-stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get data retention statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Retention statistics retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getRetentionStats(@Request() req: AuthenticatedRequest) {
    const stats = await this.gdprService.getRetentionStats();

    return {
      success: true,
      stats,
      requestedBy: req.user.id,
    };
  }

  @Post('run-cleanup')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Manually trigger GDPR data cleanup (Admin only)' })
  @ApiResponse({ status: 202, description: 'Cleanup triggered successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  runCleanup(@Request() req: AuthenticatedRequest) {
    void this.gdprService.runDataRetentionCleanup();

    return {
      success: true,
      message: 'GDPR data cleanup has been triggered. Check logs for details.',
      triggeredAt: new Date().toISOString(),
      triggeredBy: req.user.id,
    };
  }
}
