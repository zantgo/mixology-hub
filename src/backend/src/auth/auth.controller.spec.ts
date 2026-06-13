import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    isTokenBlacklisted: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        ENABLE_MOCK_AUTH: 'false',
      };
      return config[key] || defaultValue;
    }),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        JwtAuthGuard,
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should call authService.register with correct parameters', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'Password123!',
        displayName: 'Test User',
      };

      const expectedResult = {
        user: {
          id: 'user-123',
          email: registerDto.email,
          displayName: registerDto.displayName,
          emailVerified: false,
        },
        accessToken: 'accessToken123',
        refreshToken: 'refreshToken123',
        accessTokenExpiresIn: '15m',
        refreshTokenExpiresIn: '7d',
      };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const res = { cookie: jest.fn() };
      const result = await controller.register(registerDto, res as any);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refreshToken123',
        expect.any(Object),
      );
      expect(result.accessToken).toBe('accessToken123');
    });
  });

  describe('login', () => {
    it('should call authService.login with correct parameters', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const expectedResult = {
        accessToken: 'accessToken123',
        refreshToken: 'refreshToken123',
        user: {
          id: 'user-123',
          email: loginDto.email,
          displayName: 'Test User',
          emailVerified: true,
        },
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const res = { cookie: jest.fn() };
      const result = await controller.login(loginDto, res as any);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refreshToken123',
        expect.any(Object),
      );
      expect(result.accessToken).toBe('accessToken123');
    });
  });

  describe('refreshToken', () => {
    it('should call authService.refreshToken with cookie token', async () => {
      const expectedResult = {
        accessToken: 'newAccessToken123',
        refreshToken: 'newRefreshToken123',
      };

      mockAuthService.refreshToken.mockResolvedValue(expectedResult);

      const req = { cookies: { refreshToken: 'oldRefreshToken123' } };
      const res = { cookie: jest.fn() };
      const result = await controller.refreshToken(req as any, res as any);

      expect(authService.refreshToken).toHaveBeenCalledWith(
        'oldRefreshToken123',
      );
      expect(result.accessToken).toBe('newAccessToken123');
    });

    it('should return error when no refresh token cookie', async () => {
      const req = { cookies: {} };
      const res = { cookie: jest.fn() };
      await expect(
        controller.refreshToken(req as any, res as any),
      ).rejects.toThrow('No refresh token');

      expect(authService.refreshToken).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should call authService.logout with access token and cookie refresh token', async () => {
      const res = { clearCookie: jest.fn() };
      const req = {
        headers: { authorization: 'Bearer accessToken123' },
        cookies: { refreshToken: 'refreshToken123' },
        user: { id: 'user-123' },
      };
      const expectedResult = {
        success: true,
        message: 'Logged out successfully',
      };

      mockAuthService.logout.mockResolvedValue(expectedResult);

      await controller.logout(req, res as any);

      expect(authService.logout).toHaveBeenCalledWith(
        'accessToken123',
        'refreshToken123',
      );
      expect(res.clearCookie).toHaveBeenCalled();
    });

    it('should handle missing cookie', async () => {
      const res = { clearCookie: jest.fn() };
      const req = {
        headers: { authorization: 'Bearer accessToken123' },
        cookies: {},
        user: { id: 'user-123' },
      };
      const expectedResult = {
        success: true,
        message: 'Logged out successfully',
      };

      mockAuthService.logout.mockResolvedValue(expectedResult);

      await controller.logout(req, res as any);

      expect(authService.logout).toHaveBeenCalledWith(
        'accessToken123',
        undefined,
      );
      expect(res.clearCookie).toHaveBeenCalled();
    });
  });
});
