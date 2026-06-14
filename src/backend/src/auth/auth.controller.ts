import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
  Res,
  Req,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    id: string;
    email: string;
    displayName: string;
    emailVerified: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  };
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(registerDto);
    this.setRefreshCookie(res, result.refreshToken);
    this.setCsrfCookie(res, result.csrfToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
      accessTokenExpiresIn: result.accessTokenExpiresIn,
    };
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account locked' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);
    this.setRefreshCookie(res, result.refreshToken);
    this.setCsrfCookie(res, result.csrfToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
      accessTokenExpiresIn: result.accessTokenExpiresIn,
    };
  }

  @Public()
  @Get('csrf')
  @ApiOperation({ summary: 'Bootstrap CSRF token handshake' })
  @ApiResponse({ status: 200, description: 'CSRF token initialized' })
  bootstrapCsrf(@Res({ passthrough: true }) res: Response) {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    this.setCsrfCookie(res, csrfToken);
    return { success: true, csrfToken };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token successfully refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string>;
    const refreshToken = cookies.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }
    const result = await this.authService.refreshToken(refreshToken);
    this.setRefreshCookie(res, result.refreshToken);
    this.setCsrfCookie(res, result.csrfToken);
    return {
      accessToken: result.accessToken,
      accessTokenExpiresIn: result.accessTokenExpiresIn,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'User successfully logged out' })
  async logout(
    @Request() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;
    const cookies = req.cookies as Record<string, string>;
    const refreshToken = cookies.refreshToken;
    res.clearCookie('refreshToken', {
      path: '/auth',
      httpOnly: true,
      secure: true,
      sameSite: 'strict' as const,
    });
    res.clearCookie('csrf_token', {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'strict' as const,
    });
    return this.authService.logout(accessToken!, refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user from all devices' })
  @ApiResponse({ status: 200, description: 'User logged out from all devices' })
  async logoutAll(@Request() req: AuthenticatedRequest) {
    return this.authService.logoutAll(req.user.id);
  }

  @Public()
  @Post('password-reset/request')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  async requestPasswordReset(@Body('email') email: string) {
    return this.authService.requestPasswordReset(email);
  }

  @Public()
  @Post('password-reset/confirm')
  @ApiOperation({ summary: 'Confirm password reset' })
  @ApiResponse({ status: 200, description: 'Password successfully reset' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(token, newPassword);
  }

  @Public()
  @Post('request-unlock')
  @ApiOperation({ summary: 'Request account unlock' })
  @ApiResponse({ status: 200, description: 'Unlock email sent' })
  async requestUnlock(@Body('email') email: string) {
    return this.authService.requestAccountUnlock(email);
  }

  @Public()
  @Post('confirm-unlock')
  @ApiOperation({ summary: 'Confirm account unlock' })
  @ApiResponse({ status: 200, description: 'Account unlocked' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async confirmUnlock(@Body('token') token: string) {
    return this.authService.confirmAccountUnlock(token);
  }

  @Public()
  @Get('verify-email/:token')
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email successfully verified' })
  @ApiResponse({ status: 400, description: 'Invalid verification token' })
  async verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  getProfile(@Request() req: AuthenticatedRequest) {
    return {
      id: req.user.id,
      email: req.user.email,
      displayName: req.user.displayName,
      emailVerified: req.user.emailVerified,
      lastLoginAt: req.user.lastLoginAt,
      createdAt: req.user.createdAt,
    };
  }

  @Post('email-change/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate a secure email change request' })
  async requestEmailChange(
    @Request() req: AuthenticatedRequest,
    @Body('newEmail') newEmail: string,
  ) {
    if (!newEmail) {
      throw new BadRequestException('New email address is required');
    }
    return this.authService.initiateEmailChange(req.user.id, newEmail);
  }

  @Public()
  @Post('email-change/confirm')
  @ApiOperation({ summary: 'Confirm a pending secure email change' })
  async confirmEmailChange(@Body('token') token: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }
    return this.authService.confirmEmailChange(token);
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private setCsrfCookie(res: Response, token: string): void {
    res.cookie('csrf_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes (must match JWT access token TTL)
    });
  }
}
