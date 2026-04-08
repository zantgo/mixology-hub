import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
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

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(expectedResult);
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

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('refreshToken', () => {
    it('should call authService.refreshToken with correct parameters', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'refreshToken123',
      };

      const expectedResult = {
        success: true,
        accessToken: 'newAccessToken123',
        refreshToken: 'newRefreshToken123',
      };

      mockAuthService.refreshToken.mockResolvedValue(expectedResult);

      const result = await controller.refreshToken(refreshTokenDto);

      expect(authService.refreshToken).toHaveBeenCalledWith(refreshTokenDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('logout', () => {
    it('should call authService.logout with authorization header', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer accessToken123',
        },
        body: {
          refreshToken: 'refreshToken123',
        },
      };
      const expectedResult = { success: true, message: 'Logged out successfully' };

      mockAuthService.logout.mockResolvedValue(expectedResult);

      const result = await controller.logout(mockRequest);

      expect(authService.logout).toHaveBeenCalledWith('accessToken123', 'refreshToken123');
      expect(result).toEqual(expectedResult);
    });

    it('should handle missing Bearer prefix', async () => {
      const mockRequest = {
        headers: {
          authorization: 'accessToken123',
        },
        body: {
          refreshToken: 'refreshToken123',
        },
      };
      const expectedResult = { success: true, message: 'Logged out successfully' };

      mockAuthService.logout.mockResolvedValue(expectedResult);

      const result = await controller.logout(mockRequest);

      expect(authService.logout).toHaveBeenCalledWith('accessToken123', 'refreshToken123');
      expect(result).toEqual(expectedResult);
    });
  });
});
