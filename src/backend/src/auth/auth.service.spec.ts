import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { TokenBlacklist } from './entities/token-blacklist.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { SystemSetting } from '../users/entities/system-setting.entity';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let tokenBlacklistRepository: any;
  let refreshTokenRepository: any;
  let jwtService: any;
  let configService: any;
  let emailService: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    passwordHash: 'hashedPassword123',
    emailVerified: true,
    failedLoginAttempts: 0,
    accountLockedUntil: null,
    accountUnlockToken: null,
    accountUnlockExpires: null,
    lastLoginAt: null,
    refreshToken: null,
    isActive: true,
  };

  const mockTokenBlacklist = {
    id: 'blacklist-123',
    token: 'blacklistedToken',
    expiresAt: new Date(Date.now() + 3600000),
  };

  const mockRefreshToken = {
    id: 'rt-123',
    userId: 'user-123',
    tokenFamily: 'family-1',
    hashedToken: 'hashed-rt',
    isRevoked: false,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      manager: {
        transaction: jest.fn(),
      },
    };

    tokenBlacklistRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    refreshTokenRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn(),
      sign: jest.fn(),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          JWT_SECRET: 'test-secret',
          JWT_EXPIRATION: '3600s',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
          JWT_REFRESH_SECRET: 'refresh-secret',
          REFRESH_TOKEN_SECRET: 'refresh-secret',
          REFRESH_TOKEN_EXPIRATION: '7d',
          BCRYPT_SALT_ROUNDS: '10',
          MAX_LOGIN_ATTEMPTS: '5',
          ACCOUNT_LOCKOUT_MINUTES: '15',
        };
        return config[key] || defaultValue;
      }),
    };

    emailService = {
      sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountUnlockEmail: jest.fn().mockResolvedValue(undefined),
      sendEmailChangeVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendEmailChangeNoticeEmail: jest.fn().mockResolvedValue(undefined),
    };

    const cacheManagerMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const systemSettingsRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(TokenBlacklist),
          useValue: tokenBlacklistRepository,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepository,
        },
        {
          provide: getRepositoryToken(SystemSetting),
          useValue: systemSettingsRepo,
        },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: EmailService, useValue: emailService },
        { provide: CACHE_MANAGER, useValue: cacheManagerMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should successfully register a new user with default profile', async () => {
      const registerDto: RegisterDto = {
        email: 'newuser@example.com',
        password: 'Password123!',
        displayName: 'New User',
      };

      userRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      const savedUser = {
        id: 'new-user-123',
        email: registerDto.email,
        displayName: registerDto.displayName,
        emailVerified: false,
        emailVerificationToken: 'mock-verification-token',
        passwordHash: 'hashedPassword',
        refreshToken: null,
      };

      userRepository.create.mockReturnValue(savedUser);
      userRepository.manager.transaction.mockImplementation((cb: any) => {
        const mockEntityManager = {
          save: jest
            .fn()
            .mockResolvedValueOnce(savedUser)
            .mockResolvedValueOnce({}),
          create: jest.fn().mockReturnValue({}),
        };
        return cb(mockEntityManager);
      });
      jwtService.signAsync
        .mockResolvedValueOnce('mock-access-token')
        .mockResolvedValueOnce('mock-refresh-token');
      refreshTokenRepository.create.mockReturnValue(mockRefreshToken);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);
      refreshTokenRepository.find.mockResolvedValue([mockRefreshToken]);

      await service.register(registerDto);

      expect(refreshTokenRepository.save).toHaveBeenCalled();
      expect(userRepository.manager.transaction).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      const registerDto: RegisterDto = {
        email: 'existing@example.com',
        password: 'Password123!',
        displayName: 'Existing User',
      };

      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync
        .mockResolvedValueOnce('accessToken123')
        .mockResolvedValueOnce('refreshToken123');
      userRepository.save.mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date(),
      });
      refreshTokenRepository.create.mockReturnValue(mockRefreshToken);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);
      refreshTokenRepository.find.mockResolvedValue([mockRefreshToken]);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const loginDto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException for locked account', async () => {
      const lockedUser = {
        ...mockUser,
        accountLockedUntil: new Date(Date.now() + 3600000), // 1 hour from now
        passwordHash: 'hashedPassword123',
      };

      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      userRepository.findOne.mockResolvedValue(lockedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh tokens', async () => {
      const refreshTokenValue = 'validRefreshToken';

      jwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        jti: 'rt-1',
        type: 'refresh',
        family: 'family-1',
      });
      tokenBlacklistRepository.findOne.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      refreshTokenRepository.find.mockResolvedValue([mockRefreshToken]);
      userRepository.findOne.mockResolvedValue(mockUser);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);
      tokenBlacklistRepository.create.mockReturnValue(mockTokenBlacklist);
      tokenBlacklistRepository.save.mockResolvedValue(mockTokenBlacklist);
      jwtService.signAsync
        .mockResolvedValueOnce('newAccessToken')
        .mockResolvedValueOnce('newRefreshToken');
      refreshTokenRepository.create.mockReturnValue({
        ...mockRefreshToken,
        id: 'rt-2',
        tokenFamily: 'family-2',
      });

      const result = await service.refreshToken(refreshTokenValue);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(service.refreshToken('invalidRefreshToken')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when refresh token doesnt match', async () => {
      const refreshTokenValue = 'wrongToken';

      jwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        family: 'family-1',
      });
      tokenBlacklistRepository.findOne.mockResolvedValue(null);
      refreshTokenRepository.find.mockResolvedValue([mockRefreshToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      refreshTokenRepository.update.mockResolvedValue({ affected: 1 });

      await expect(service.refreshToken(refreshTokenValue)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for blacklisted token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        family: 'family-1',
      });
      tokenBlacklistRepository.findOne.mockResolvedValue(mockTokenBlacklist);
      refreshTokenRepository.update.mockResolvedValue({ affected: 1 });

      await expect(service.refreshToken('blacklistedToken')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should successfully logout and blacklist token', async () => {
      const accessToken = 'validAccessToken';

      tokenBlacklistRepository.create.mockReturnValue(mockTokenBlacklist);
      tokenBlacklistRepository.save.mockResolvedValue(mockTokenBlacklist);

      await service.logout(accessToken);

      expect(tokenBlacklistRepository.save).toHaveBeenCalled();
    });

    it('should blacklist both access and refresh token', async () => {
      const accessToken = 'validAccessToken';
      const refreshTokenValue = 'validRefreshToken';

      tokenBlacklistRepository.create.mockReturnValue(mockTokenBlacklist);
      tokenBlacklistRepository.save.mockResolvedValue(mockTokenBlacklist);

      await service.logout(accessToken, refreshTokenValue);

      expect(tokenBlacklistRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateUser', () => {
    it('should return user for valid JWT payload', async () => {
      const payload = { sub: 'user-123', jti: 'token-123' };

      userRepository.findOne.mockResolvedValue(mockUser);
      tokenBlacklistRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser(payload, 'mock-token');

      expect(result).toBeDefined();
      expect(result!.id).toBe(mockUser.id);
      expect(result!.email).toBe(mockUser.email);
    });

    it('should return null for blacklisted token', async () => {
      const payload = { sub: 'user-123', jti: 'blacklisted-token-123' };

      userRepository.findOne.mockResolvedValue(mockUser);
      tokenBlacklistRepository.findOne.mockResolvedValue(mockTokenBlacklist);

      const result = await service.validateUser(payload, 'mock-token');

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      const payload = { sub: 'non-existent-user', jti: 'token-123' };

      userRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser(payload, 'mock-token');

      expect(result).toBeNull();
    });
  });
});
