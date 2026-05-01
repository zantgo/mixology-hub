import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { TokenBlacklist } from './entities/token-blacklist.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UnauthorizedException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let tokenBlacklistRepository: any;
  let jwtService: any;
  let configService: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashedPassword123',
    emailVerified: true,
    failedLoginAttempts: 0,
    accountLockedUntil: null,
    lastLoginAt: null,
    refreshToken: 'validRefreshToken',
    isActive: true,
  };

  const mockTokenBlacklist = {
    id: 'blacklist-123',
    token: 'blacklistedToken',
    expiresAt: new Date(Date.now() + 3600000),
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    tokenBlacklistRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
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
        const config = {
          'JWT_SECRET': 'test-secret',
          'JWT_EXPIRATION': '3600s',
          'JWT_ACCESS_EXPIRES_IN': '15m',
          'JWT_REFRESH_EXPIRES_IN': '7d',
          'JWT_REFRESH_SECRET': 'refresh-secret',
          'REFRESH_TOKEN_SECRET': 'refresh-secret',
          'REFRESH_TOKEN_EXPIRATION': '7d',
          'BCRYPT_SALT_ROUNDS': '10',
          'MAX_LOGIN_ATTEMPTS': '5',
          'ACCOUNT_LOCKOUT_MINUTES': '15',
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(TokenBlacklist),
          useValue: tokenBlacklistRepository,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
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
        passwordHash: 'hashedPassword',
        refreshToken: null,
      };
      
      userRepository.create.mockReturnValue(savedUser);
      userRepository.save.mockResolvedValue(savedUser);

      const result = await service.register(registerDto);

      expect(result.user.email).toBe(registerDto.email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      const registerDto: RegisterDto = {
        email: 'existing@example.com',
        password: 'Password123!',
        displayName: 'Existing User',
      };

      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.register(registerDto))
        .rejects.toThrow(ConflictException);
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
      // Mock signAsync to return tokens - simpler approach
      jwtService.signAsync
        .mockResolvedValueOnce('accessToken123')
        .mockResolvedValueOnce('refreshToken123');
      
      // Also mock the regular sign method for decode
      jwtService.sign.mockReturnValue('token');
      jwtService.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });
      userRepository.save.mockResolvedValue({ ...mockUser, lastLoginAt: new Date() });

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

      await expect(service.login(loginDto))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const loginDto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto))
        .rejects.toThrow(UnauthorizedException);
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

      await expect(service.login(loginDto))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh tokens', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'validRefreshToken',
      };

      const userWithRefreshToken = {
        ...mockUser,
        refreshToken: 'validRefreshToken',
      };

      userRepository.findOne.mockResolvedValue(userWithRefreshToken);
      jwtService.verifyAsync.mockResolvedValue({ userId: mockUser.id });
      jwtService.signAsync.mockResolvedValue('newAccessToken');
      jwtService.signAsync.mockResolvedValueOnce('newAccessToken');
      jwtService.signAsync.mockResolvedValueOnce('newRefreshToken');

      const result = await service.refreshToken(refreshTokenDto);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'invalidRefreshToken',
      };

      userRepository.findOne.mockResolvedValue(mockUser);
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken(refreshTokenDto))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when refresh token doesnt match', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'differentRefreshToken',
      };

      userRepository.findOne.mockResolvedValue(mockUser);
      jwtService.verify.mockReturnValue({ userId: mockUser.id });

      await expect(service.refreshToken(refreshTokenDto))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should successfully logout and blacklist token', async () => {
      const accessToken = 'validAccessToken';
      const decodedToken = { exp: Math.floor(Date.now() / 1000) + 3600 };

      jwtService.decode.mockReturnValue(decodedToken);
      tokenBlacklistRepository.create.mockReturnValue(mockTokenBlacklist);
      tokenBlacklistRepository.save.mockResolvedValue(mockTokenBlacklist);

      await service.logout(accessToken);

      expect(tokenBlacklistRepository.save).toHaveBeenCalled();
    });

    it('should handle already expired token', async () => {
      const accessToken = 'expiredToken';
      const decodedToken = { exp: Math.floor(Date.now() / 1000) - 3600 };

      jwtService.decode.mockReturnValue(decodedToken);

      await service.logout(accessToken);

      // Even expired tokens should be blacklisted for security
      expect(tokenBlacklistRepository.save).toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('should return user for valid JWT payload', async () => {
      const payload = { sub: 'user-123', jti: 'token-123' };

      userRepository.findOne.mockResolvedValue(mockUser);
      tokenBlacklistRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser(payload);

      expect(result).toBeDefined();
      expect(result!.id).toBe(mockUser.id);
      expect(result!.email).toBe(mockUser.email);
    });

    it('should return null for blacklisted token', async () => {
      const payload = { sub: 'user-123', jti: 'blacklisted-token-123' };

      userRepository.findOne.mockResolvedValue(mockUser);
      tokenBlacklistRepository.findOne.mockResolvedValue(mockTokenBlacklist);

      const result = await service.validateUser(payload);

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      const payload = { sub: 'non-existent-user', jti: 'token-123' };

      userRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser(payload);

      expect(result).toBeNull();
    });
  });


});