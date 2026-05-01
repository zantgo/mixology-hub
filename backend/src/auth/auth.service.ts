import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklist } from './entities/token-blacklist.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TokenBlacklist)
    private readonly tokenBlacklistRepository: Repository<TokenBlacklist>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = this.userRepository.create({
      email: registerDto.email,
      passwordHash: hashedPassword,
      displayName: registerDto.displayName || registerDto.email.split('@')[0],
      emailVerified: false,
    });

    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    // Find user
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      throw new ForbiddenException('Account is temporarily locked due to too many failed attempts');
    }

    // Reset failed login attempts on successful login
    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      await this.userRepository.save(user);
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
      },
      ...tokens,
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      // Verify refresh token
      const payload = await this.jwtService.verifyAsync(refreshTokenDto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Check if token is blacklisted
      const isBlacklisted = await this.tokenBlacklistRepository.findOne({
        where: { token: refreshTokenDto.refreshToken },
      });
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if refresh token matches the one stored
      if (user.refreshToken !== refreshTokenDto.refreshToken) {
        // Token reuse detected - blacklist all tokens for this user
        await this.blacklistAllUserTokens(user.id);
        throw new UnauthorizedException('Token reuse detected');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Blacklist the old refresh token
      await this.blacklistToken(refreshTokenDto.refreshToken, 'refresh_token_replaced');

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(accessToken: string, refreshToken?: string) {
    // Extract token from "Bearer <token>" format
    const token = accessToken.replace('Bearer ', '');

    // Blacklist access token
    await this.blacklistToken(token, 'user_logout');

    // Blacklist refresh token if provided
    if (refreshToken) {
      await this.blacklistToken(refreshToken, 'user_logout');
    }

    return { success: true, message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.blacklistAllUserTokens(userId);
  }

  async validateUser(payload: any): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      return null;
    }

    // Check if token is blacklisted
    const isBlacklisted = await this.tokenBlacklistRepository.findOne({
      where: { token: payload.jti },
    });
    if (isBlacklisted) {
      return null;
    }

    return user;
  }

  private async generateTokens(user: User) {
    const accessTokenId = uuidv4();
    const refreshTokenId = uuidv4();

    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      jti: accessTokenId,
      type: 'access',
    };

    const refreshTokenPayload = {
      sub: user.id,
      jti: refreshTokenId,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as any,
      }),
      this.jwtService.signAsync(refreshTokenPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as any,
      }),
    ]);

    // Store refresh token hash in database
    user.refreshToken = refreshToken;
    await this.userRepository.save(user);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      refreshTokenExpiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    };
  }

  private async blacklistToken(token: string, reason: string) {
    const tokenBlacklist = this.tokenBlacklistRepository.create({
      token,
      reason,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    });
    await this.tokenBlacklistRepository.save(tokenBlacklist);
  }

  private async blacklistAllUserTokens(userId: string) {
    // In a real implementation, you might want to track all issued tokens
    // For now, we'll just clear the refresh token from the user record
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.refreshToken = null;
      await this.userRepository.save(user);
    }
  }

  async requestPasswordReset(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal that user doesn't exist for security
      return;
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await this.userRepository.save(user);

    // In a real application, send email with reset link
    // For now, return the token (in production, this would be sent via email)
    return { resetToken };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userRepository.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    user.passwordHash = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.failedLoginAttempts = 0; // Reset failed attempts

    await this.userRepository.save(user);

    // Blacklist all existing tokens for security
    await this.blacklistAllUserTokens(user.id);

    return { success: true };
  }

  async verifyEmail(token: string) {
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    await this.userRepository.save(user);

    return { success: true };
  }
}
