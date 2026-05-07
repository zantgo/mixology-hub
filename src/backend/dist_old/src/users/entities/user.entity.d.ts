export declare class User {
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
}
