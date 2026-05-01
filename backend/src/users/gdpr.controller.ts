import { Controller, Post, Get, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GdprDataRetentionService } from './gdpr-data-retention.service';
import { User } from './entities/user.entity';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('GDPR')
@ApiBearerAuth()
@Controller('gdpr')
export class GdprController {
  constructor(private readonly gdprService: GdprDataRetentionService) {}

  @Get('export-data')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Export all user data (GDPR right to access)' })
  @ApiResponse({ status: 200, description: 'User data exported successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async exportUserData(@Request() req) {
    const data = await this.gdprService.exportUserData(req.user.id);
    return {
      success: true,
      data,
      exportedAt: new Date().toISOString(),
    };
  }

  @Post('request-deletion')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Request account deletion (GDPR right to be forgotten)' })
  @ApiResponse({ status: 202, description: 'Deletion request accepted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async requestAccountDeletion(@Request() req) {
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
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Get data retention statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Retention statistics retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getRetentionStats(@Request() req) {
    const stats = await this.gdprService.getRetentionStats();
    
    return {
      success: true,
      stats,
      requestedBy: req.user.id,
    };
  }

  @Post('run-cleanup')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Manually trigger GDPR data cleanup (Admin only)' })
  @ApiResponse({ status: 202, description: 'Cleanup triggered successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async runCleanup(@Request() req) {
    this.gdprService.runDataRetentionCleanup();
    
    return {
      success: true,
      message: 'GDPR data cleanup has been triggered. Check logs for details.',
      triggeredAt: new Date().toISOString(),
      triggeredBy: req.user.id,
    };
  }
}