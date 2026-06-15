import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { User } from '../users/entities/user.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { SystemSetting } from '../users/entities/system-setting.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklist } from './entities/token-blacklist.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { EmailService } from '../email/email.service';
import { v4 as uuidv4 } from 'uuid';
import { validatePasswordStrength } from './validators/is-strong-password.validator';

const MAX_SESSIONS = 5;
const BLACKLIST_CACHE_PREFIX = 'blacklist:token:';
const BLACKLIST_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const DUMMY_BCRYPT_HASH =
  '$2b$10$rQnM1.FZ2FVKGqC0I0bhPO1G.8hlv5Frk3kOWh3yqZDZH3M/GxcHq';

interface JwtPayload {
  sub: string;
  email?: string;
  jti?: string;
  type?: string;
  tokenVersion?: number;
  family?: string;
  saltVersion?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TokenBlacklist)
    private readonly tokenBlacklistRepository: Repository<TokenBlacklist>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(SystemSetting)
    private readonly systemSettingsRepository: Repository<SystemSetting>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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

    const result = await this.userRepository.manager.transaction(
      async (transactionalEntityManager) => {
        // Create user
        const emailToken = crypto.randomBytes(32).toString('hex');
        const user = this.userRepository.create({
          email: registerDto.email,
          passwordHash: hashedPassword,
          displayName:
            registerDto.displayName || registerDto.email.split('@')[0],
          emailVerified: false,
          emailVerificationToken: emailToken,
        });

        const savedUser = await transactionalEntityManager.save(user);

        // Seed default system preferences for UserProfile atomically (UC 9.20)
        const profile = transactionalEntityManager.create(UserProfile, {
          user: savedUser,
          unitSystem: 'metric',
          theme: 'system',
          defaultServings: 1,
          defaultPartSize: 30,
          showTutorial: true,
        });
        await transactionalEntityManager.save(profile);

        return savedUser;
      },
    );

    // Send verification email
    this.emailService
      .sendEmailVerificationEmail(result.email, result.emailVerificationToken!)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to send verification email: ${message}`);
      });

    // Generate tokens
    const tokens = await this.generateTokens(result);

    return {
      user: {
        id: result.id,
        email: result.email,
        displayName: result.displayName,
        emailVerified: result.emailVerified,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (user?.accountLockedUntil && user.accountLockedUntil > new Date()) {
      throw new ForbiddenException(
        'Account is temporarily locked due to too many failed attempts',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user ? user.passwordHash : DUMMY_BCRYPT_HASH,
    );

    if (!user || !isPasswordValid) {
      if (user) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
          user.failedLoginAttempts = 0;
        }
        await this.userRepository.save(user);
      }
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
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshTokenValue,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      );

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

  async validateUser(payload: JwtPayload, token: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      return null;
    }

    // Check if token is blacklisted — Redis cache first, DB as fallback
    const tokenHash = this.hashToken(token);
    const blacklistCacheKey = `${BLACKLIST_CACHE_PREFIX}${tokenHash}`;
    const cachedBlacklist =
      await this.cacheManager.get<string>(blacklistCacheKey);
    if (cachedBlacklist) {
      return null;
    }

    const isBlacklisted = await this.tokenBlacklistRepository.findOne({
      where: { token },
    });
    if (isBlacklisted) {
      await this.cacheManager.set(blacklistCacheKey, '1', BLACKLIST_CACHE_TTL);
      return null;
    }

    // Check token version (invalidates sessions on password reset/change)
    if (
      payload.tokenVersion !== undefined &&
      payload.tokenVersion !== user.tokenVersion
    ) {
      return null;
    }

    // Check global token salt version (invalidates sessions on emergency admin revocation)
    // Retrieve from Redis cache (5min TTL) to prevent DB bottleneck on every request
    const cacheKey = 'setting:global_token_salt_version';
    let saltVersionString = await this.cacheManager.get<string>(cacheKey);

    if (!saltVersionString) {
      const saltSetting = await this.systemSettingsRepository.findOne({
        where: { settingKey: 'global_token_salt_version' },
      });
      saltVersionString = saltSetting ? saltSetting.settingValue : '0';
      await this.cacheManager.set(cacheKey, saltVersionString, 300000);
    }

    const currentSaltVersion = parseInt(saltVersionString, 10) || 0;
    if (
      payload.saltVersion !== undefined &&
      payload.saltVersion < currentSaltVersion
    ) {
      return null;
    }

    return user;
  }

  private async generateTokens(user: User) {
    const accessTokenId = uuidv4();
    const refreshTokenId = uuidv4();

    const saltSetting = await this.systemSettingsRepository.findOne({
      where: { settingKey: 'global_token_salt_version' },
    });
    const currentSaltVersion = saltSetting
      ? parseInt(saltSetting.settingValue, 10) || 0
      : 0;

    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      jti: accessTokenId,
      type: 'access',
      tokenVersion: user.tokenVersion,
      saltVersion: currentSaltVersion,
    };

    const refreshTokenPayload = {
      sub: user.id,
      jti: refreshTokenId,
      type: 'refresh',
      family: uuidv4(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload as Record<string, unknown>, {
        secret: this.configService.get<string>('JWT_SECRET')!,
        expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ??
          '15m') as any,
      }),
      this.jwtService.signAsync(
        refreshTokenPayload as Record<string, unknown>,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET')!,
          expiresIn: (this.configService.get<string>(
            'JWT_REFRESH_EXPIRES_IN',
          ) ?? '7d') as any,
        },
      ),
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
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `Failed to send session eviction email: ${message}`,
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

    const tokenHash = this.hashToken(token);
    await this.cacheManager.set(
      `${BLACKLIST_CACHE_PREFIX}${tokenHash}`,
      '1',
      BLACKLIST_CACHE_TTL,
    );
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
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to send password reset email: ${message}`);
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
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      throw new BadRequestException(passwordError);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password, increment tokenVersion, clear reset token AND clear brute-force lockout states
    user.passwordHash = hashedPassword;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = null;

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
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to send unlock email: ${message}`);
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

  async revokeAllSessions(
    adminId: string,
    clientIp: string,
    reason: string,
  ): Promise<{ revoked: number }> {
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

    await this.cacheManager.del('setting:global_token_salt_version');

    const result = await this.refreshTokenRepository.update(
      {},
      { isRevoked: true },
    );

    this.logger.warn({
      event: 'emergency_global_session_revocation',
      adminId,
      clientIp,
      reason,
      revokedCount: result.affected || 0,
      timestamp: new Date().toISOString(),
      alert: true,
    });

    return { revoked: result.affected || 0 };
  }

  async initiateEmailChange(
    userId: string,
    newEmail: string,
  ): Promise<{ message: string }> {
    const normalizedEmail = newEmail.toLowerCase().trim();
    const existing = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.tempNewEmail = normalizedEmail;
    user.emailChangeToken = this.hashToken(rawToken);
    await this.userRepository.save(user);

    await this.emailService.sendEmailChangeVerificationEmail(
      normalizedEmail,
      rawToken,
    );

    await this.emailService.sendEmailChangeNoticeEmail(
      user.email,
      normalizedEmail,
    );

    return { message: 'Verification email sent to the new email address.' };
  }

  async confirmEmailChange(
    token: string,
  ): Promise<{ success: boolean; message: string }> {
    const tokenHash = this.hashToken(token);
    const user = await this.userRepository.findOne({
      where: { emailChangeToken: tokenHash },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired email change token');
    }

    const oldEmail = user.email;

    if (!user.tempNewEmail) {
      throw new BadRequestException('No pending email change');
    }

    await this.userRepository.manager.transaction(
      async (transactionalEntityManager) => {
        user.email = user.tempNewEmail!;
        user.tempNewEmail = null;
        user.emailChangeToken = null;
        user.emailVerified = true;
        user.tokenVersion += 1;

        await transactionalEntityManager.save(user);

        await transactionalEntityManager
          .createQueryBuilder()
          .update(RefreshToken)
          .set({ isRevoked: true })
          .where('user_id = :userId', { userId: user.id })
          .execute();
      },
    );

    return {
      success: true,
      message: `Your email has been successfully changed from ${oldEmail} to ${user.email}. Please log in again.`,
    };
  }
}
