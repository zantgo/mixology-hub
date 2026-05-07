import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklist } from './entities/token-blacklist.entity';
export declare class AuthService {
    private readonly userRepository;
    private readonly tokenBlacklistRepository;
    private readonly jwtService;
    private readonly configService;
    constructor(userRepository: Repository<User>, tokenBlacklistRepository: Repository<TokenBlacklist>, jwtService: JwtService, configService: ConfigService);
    register(registerDto: RegisterDto): Promise<{
        accessToken: string;
        refreshToken: string;
        accessTokenExpiresIn: string;
        refreshTokenExpiresIn: string;
        user: {
            id: string;
            email: string;
            displayName: string;
            emailVerified: boolean;
        };
    }>;
    login(loginDto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        accessTokenExpiresIn: string;
        refreshTokenExpiresIn: string;
        user: {
            id: string;
            email: string;
            displayName: string;
            emailVerified: boolean;
        };
    }>;
    refreshToken(refreshTokenDto: RefreshTokenDto): Promise<{
        accessToken: string;
        refreshToken: string;
        accessTokenExpiresIn: string;
        refreshTokenExpiresIn: string;
    }>;
    logout(accessToken: string, refreshToken?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    logoutAll(userId: string): Promise<void>;
    validateUser(payload: any): Promise<User | null>;
    private generateTokens;
    private blacklistToken;
    private blacklistAllUserTokens;
    requestPasswordReset(email: string): Promise<{
        resetToken: string;
    } | undefined>;
    resetPassword(token: string, newPassword: string): Promise<{
        success: boolean;
    }>;
    verifyEmail(token: string): Promise<{
        success: boolean;
    }>;
}
