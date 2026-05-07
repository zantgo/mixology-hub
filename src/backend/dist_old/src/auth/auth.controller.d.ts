import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
    logout(req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    logoutAll(req: any): Promise<void>;
    requestPasswordReset(email: string): Promise<{
        resetToken: string;
    } | undefined>;
    resetPassword(token: string, newPassword: string): Promise<{
        success: boolean;
    }>;
    verifyEmail(token: string): Promise<{
        success: boolean;
    }>;
    getProfile(req: any): Promise<{
        id: any;
        email: any;
        displayName: any;
        emailVerified: any;
        lastLoginAt: any;
        createdAt: any;
    }>;
}
