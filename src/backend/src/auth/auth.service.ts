import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { SystemSettings } from '../users/entities/system-settings.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklist } from './entities/token-blacklist.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { EmailService } from '../email/email.service';
import { v4 as uuidv4 } from 'uuid';

const MAX_SESSIONS = 5;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TokenBlacklist)
    private readonly tokenBlacklistRepository: Repository<TokenBlacklist>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(SystemSettings)
    private readonly systemSettingsRepository: Repository<SystemSettings>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
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
    const emailToken = crypto.randomBytes(32).toString('hex');
    const user = this.userRepository.create({
      email: registerDto.email,
      passwordHash: hashedPassword,
      displayName: registerDto.displayName || registerDto.email.split('@')[0],
      emailVerified: false,
      emailVerificationToken: emailToken,
    });

    await this.userRepository.save(user);

    // Send verification email
    this.emailService
      .sendEmailVerificationEmail(user.email, emailToken)
      .catch((err) => {
        console.error('Failed to send verification email:', err.message);
      });

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

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      throw new ForbiddenException(
        'Account is temporarily locked due to too many failed attempts',
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.failedLoginAttempts = 0;
      }
      await this.userRepository.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login timestamp and reset failed attempts on successful login
    user.lastLoginAt = new Date();
    if (user.failedLoginAttempts > 0 || user.accountLockedUntil) {
      user.failedLoginAttempts = 0;
      user.accountLockedUntil = null;
    }
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

  async refreshToken(refreshTokenValue: string) {
    try {
      // Verify refresh token
      const payload = await this.jwtService.verifyAsync(refreshTokenValue, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Check if token is blacklisted
      const isBlacklisted = await this.tokenBlacklistRepository.findOne({
        where: { token: refreshTokenValue },
      });
      if (isBlacklisted) {
        // Revoke entire token family if a blacklisted token is reused
        if (payload.family) {
          await this.revokeTokenFamily(payload.family);
        }
        throw new UnauthorizedException('Token has been revoked');
      }

      // Find matching refresh token record
      const matchingRecords = await this.refreshTokenRepository.find({
        where: { userId: payload.sub, isRevoked: false },
      });

      let matchedRecord: RefreshToken | null = null;
      for (const record of matchingRecords) {
        const matches = await bcrypt.compare(
          refreshTokenValue,
          record.hashedToken,
        );
        if (matches) {
          matchedRecord = record;
          break;
        }
      }

      if (!matchedRecord) {
        // Token reuse detected — revoke entire family
        if (payload.family) {
          await this.revokeTokenFamily(payload.family);
        }
        throw new UnauthorizedException('Token reuse detected');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Revoke old refresh token record and generate new tokens
      matchedRecord.isRevoked = true;
      await this.refreshTokenRepository.save(matchedRecord);

      // Blacklist the old refresh token
      await this.blacklistToken(refreshTokenValue, 'refresh_token_replaced');

      // Generate new tokens (rotation)
      const tokens = await this.generateTokens(user);

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async revokeTokenFamily(family: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { tokenFamily: family },
      { isRevoked: true },
    );
  }

  async logout(accessToken: string, refreshToken?: string) {
    // Token is already extracted by the controller (stripped of 'Bearer ' prefix)
    await this.blacklistToken(accessToken, 'user_logout');

    // Blacklist refresh token if provided
    if (refreshToken) {
      await this.blacklistToken(refreshToken, 'user_logout');
    }

    return { success: true, message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.blacklistAllUserTokens(userId);
  }

  async validateUser(payload: any, token: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      return null;
    }

    // Check if token is blacklisted by actual token value
    const isBlacklisted = await this.tokenBlacklistRepository.findOne({
      where: { token },
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
      family: uuidv4(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
          '15m',
        ) as any,
      }),
      this.jwtService.signAsync(refreshTokenPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as any,
      }),
    ]);

    // Store HASHED refresh token in refresh_tokens table for multi-session support
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      tokenFamily: refreshTokenPayload.family,
      hashedToken: refreshTokenHash,
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await this.refreshTokenRepository.save(refreshTokenEntity);

    // Enforce max session limit: revoke oldest sessions if over limit
    await this.enforceSessionLimit(user.id);

    const csrfToken = crypto.randomBytes(32).toString('hex');

    return {
      accessToken,
      refreshToken,
      csrfToken,
      accessTokenExpiresIn: this.configService.get<string>(
        'JWT_ACCESS_EXPIRES_IN',
        '15m',
      ),
      refreshTokenExpiresIn: this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '7d',
      ),
    };
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const activeSessions = await this.refreshTokenRepository.find({
      where: { userId, isRevoked: false },
      order: { createdAt: 'ASC' },
    });

    if (activeSessions.length > MAX_SESSIONS) {
      const toRevoke = activeSessions.slice(
        0,
        activeSessions.length - MAX_SESSIONS,
      );
      for (const session of toRevoke) {
        session.isRevoked = true;
      }
      await this.refreshTokenRepository.save(toRevoke);

      const user = await this.userRepository.findOne({
        where: { id: userId },
      });
      if (user) {
        this.emailService
          .sendSessionEvictionEmail(user.email, toRevoke.length)
          .catch((err) => {
            console.error(
              'Failed to send session eviction email:',
              err.message,
            );
          });
      }
    }
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
    // Revoke all active refresh token records for this user
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async requestPasswordReset(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal that user doesn't exist for security
      return;
    }

    // Generate strong reset token (32 random bytes = 256 bits of entropy)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    // Store SHA-256 hash so raw token is never exposed in the database
    user.resetPasswordToken = this.hashToken(resetToken);
    user.resetPasswordExpires = resetTokenExpiry;
    await this.userRepository.save(user);

    // Send the raw token via email
    this.emailService
      .sendPasswordResetEmail(user.email, resetToken)
      .catch((err) => {
        console.error('Failed to send password reset email:', err.message);
      });

    return {
      message:
        'If the email is registered, a password reset link has been sent.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);
    const user = await this.userRepository.findOne({
      where: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Validate password strength
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      throw new BadRequestException(
        'Password must contain uppercase, lowercase, number, and special character',
      );
    }
    // Check common passwords
    const COMMON_PASSWORDS = new Set([
      'password',
      'password1',
      'password123',
      'admin',
      'admin123',
      '123456',
      '12345678',
      'qwerty',
      'qwerty123',
      'abc123',
      'letmein',
      'welcome',
      'monkey',
      'dragon',
      'master',
      'login',
      'princess',
      'football',
      'shadow',
      'sunshine',
      'trustno1',
      'iloveyou',
    ]);
    if (COMMON_PASSWORDS.has(newPassword.toLowerCase())) {
      throw new BadRequestException('Password is too common');
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

  async requestAccountUnlock(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return {
        message:
          'If the account exists and is locked, an unlock email has been sent.',
      };
    }

    if (!user.accountLockedUntil || user.accountLockedUntil <= new Date()) {
      return {
        message:
          'If the account exists and is locked, an unlock email has been sent.',
      };
    }

    const unlockToken = crypto.randomBytes(32).toString('hex');
    user.accountUnlockToken = this.hashToken(unlockToken);
    user.accountUnlockExpires = new Date(Date.now() + 60 * 60 * 1000);
    await this.userRepository.save(user);

    this.emailService
      .sendAccountUnlockEmail(user.email, unlockToken)
      .catch((err) => {
        console.error('Failed to send unlock email:', err.message);
      });

    return {
      message:
        'If the account exists and is locked, an unlock email has been sent.',
    };
  }

  async confirmAccountUnlock(token: string) {
    const tokenHash = this.hashToken(token);
    const user = await this.userRepository.findOne({
      where: {
        accountUnlockToken: tokenHash,
        accountUnlockExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired unlock token');
    }

    user.failedLoginAttempts = 0;
    user.accountLockedUntil = null;
    user.accountUnlockToken = null;
    user.accountUnlockExpires = null;
    await this.userRepository.save(user);

    return { success: true, message: 'Account unlocked successfully' };
  }

  async revokeAllSessions(): Promise<{ revoked: number }> {
    const SETTING_KEY = 'global_token_salt_version';

    let setting = await this.systemSettingsRepository.findOne({
      where: { settingKey: SETTING_KEY },
    });

    if (setting) {
      const currentVersion = parseInt(setting.settingValue, 10) || 0;
      setting.settingValue = String(currentVersion + 1);
    } else {
      setting = this.systemSettingsRepository.create({
        settingKey: SETTING_KEY,
        settingValue: '1',
      });
    }

    await this.systemSettingsRepository.save(setting);

    const result = await this.refreshTokenRepository.update(
      {},
      { isRevoked: true },
    );

    return { revoked: result.affected || 0 };
  }
}
