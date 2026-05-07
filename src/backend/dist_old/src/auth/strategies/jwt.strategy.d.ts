import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
declare const JwtStrategy_base: new (...args: any) => any;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly configService;
    private readonly authService;
    constructor(configService: ConfigService, authService: AuthService);
    validate(request: any, payload: any): Promise<{
        token: any;
        id: string;
        email: string;
        displayName: string;
        passwordHash: string;
        emailVerified: boolean;
        emailVerificationToken: string | null;
        resetPasswordToken: string | null;
        resetPasswordExpires: Date | null;
        refreshToken: string | null;
        failedLoginAttempts: number;
        accountLockedUntil: Date | null;
        lastLoginAt: Date | null;
        gdprDeletionRequested: boolean;
        gdprDeletionScheduledAt: Date | null;
        is_anonymized: boolean;
        anonymized_at: Date | null;
        username: string | null;
        first_name: string | null;
        last_name: string | null;
        profile_picture_url: string | null;
        bio: string | null;
        date_of_birth: Date | null;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
    }>;
}
export {};
