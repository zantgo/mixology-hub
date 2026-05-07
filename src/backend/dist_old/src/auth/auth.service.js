"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../users/entities/user.entity");
const bcrypt = __importStar(require("bcrypt"));
const config_1 = require("@nestjs/config");
const token_blacklist_entity_1 = require("./entities/token-blacklist.entity");
const uuid_1 = require("uuid");
let AuthService = class AuthService {
    userRepository;
    tokenBlacklistRepository;
    jwtService;
    configService;
    constructor(userRepository, tokenBlacklistRepository, jwtService, configService) {
        this.userRepository = userRepository;
        this.tokenBlacklistRepository = tokenBlacklistRepository;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async register(registerDto) {
        const existingUser = await this.userRepository.findOne({
            where: { email: registerDto.email },
        });
        if (existingUser) {
            throw new common_1.ConflictException('User with this email already exists');
        }
        const hashedPassword = await bcrypt.hash(registerDto.password, 10);
        const user = this.userRepository.create({
            email: registerDto.email,
            passwordHash: hashedPassword,
            displayName: registerDto.displayName || registerDto.email.split('@')[0],
            emailVerified: false,
        });
        await this.userRepository.save(user);
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
    async login(loginDto) {
        const user = await this.userRepository.findOne({
            where: { email: loginDto.email },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
            throw new common_1.ForbiddenException('Account is temporarily locked due to too many failed attempts');
        }
        if (user.failedLoginAttempts > 0) {
            user.failedLoginAttempts = 0;
            await this.userRepository.save(user);
        }
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
    async refreshToken(refreshTokenDto) {
        try {
            const payload = await this.jwtService.verifyAsync(refreshTokenDto.refreshToken, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
            });
            const isBlacklisted = await this.tokenBlacklistRepository.findOne({
                where: { token: refreshTokenDto.refreshToken },
            });
            if (isBlacklisted) {
                throw new common_1.UnauthorizedException('Token has been revoked');
            }
            const user = await this.userRepository.findOne({
                where: { id: payload.sub },
            });
            if (!user) {
                throw new common_1.UnauthorizedException('User not found');
            }
            if (user.refreshToken !== refreshTokenDto.refreshToken) {
                await this.blacklistAllUserTokens(user.id);
                throw new common_1.UnauthorizedException('Token reuse detected');
            }
            const tokens = await this.generateTokens(user);
            await this.blacklistToken(refreshTokenDto.refreshToken, 'refresh_token_replaced');
            return tokens;
        }
        catch (error) {
            if (error instanceof common_1.UnauthorizedException) {
                throw error;
            }
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    async logout(accessToken, refreshToken) {
        const token = accessToken.replace('Bearer ', '');
        await this.blacklistToken(token, 'user_logout');
        if (refreshToken) {
            await this.blacklistToken(refreshToken, 'user_logout');
        }
        return { success: true, message: 'Logged out successfully' };
    }
    async logoutAll(userId) {
        await this.blacklistAllUserTokens(userId);
    }
    async validateUser(payload) {
        const user = await this.userRepository.findOne({
            where: { id: payload.sub },
        });
        if (!user) {
            return null;
        }
        const isBlacklisted = await this.tokenBlacklistRepository.findOne({
            where: { token: payload.jti },
        });
        if (isBlacklisted) {
            return null;
        }
        return user;
    }
    async generateTokens(user) {
        const accessTokenId = (0, uuid_1.v4)();
        const refreshTokenId = (0, uuid_1.v4)();
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
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(accessTokenPayload, {
                secret: this.configService.get('JWT_SECRET'),
                expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', '15m'),
            }),
            this.jwtService.signAsync(refreshTokenPayload, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
                expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
            }),
        ]);
        user.refreshToken = refreshToken;
        await this.userRepository.save(user);
        return {
            accessToken,
            refreshToken,
            accessTokenExpiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', '15m'),
            refreshTokenExpiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
        };
    }
    async blacklistToken(token, reason) {
        const tokenBlacklist = this.tokenBlacklistRepository.create({
            token,
            reason,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        await this.tokenBlacklistRepository.save(tokenBlacklist);
    }
    async blacklistAllUserTokens(userId) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user) {
            user.refreshToken = null;
            await this.userRepository.save(user);
        }
    }
    async requestPasswordReset(email) {
        const user = await this.userRepository.findOne({ where: { email } });
        if (!user) {
            return;
        }
        const resetToken = (0, uuid_1.v4)();
        const resetTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000);
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetTokenExpiry;
        await this.userRepository.save(user);
        return { resetToken };
    }
    async resetPassword(token, newPassword) {
        const user = await this.userRepository.findOne({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: (0, typeorm_2.MoreThan)(new Date()),
            },
        });
        if (!user) {
            throw new common_1.BadRequestException('Invalid or expired reset token');
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.passwordHash = hashedPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        user.failedLoginAttempts = 0;
        await this.userRepository.save(user);
        await this.blacklistAllUserTokens(user.id);
        return { success: true };
    }
    async verifyEmail(token) {
        const user = await this.userRepository.findOne({
            where: { emailVerificationToken: token },
        });
        if (!user) {
            throw new common_1.BadRequestException('Invalid verification token');
        }
        user.emailVerified = true;
        user.emailVerificationToken = null;
        await this.userRepository.save(user);
        return { success: true };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(token_blacklist_entity_1.TokenBlacklist)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map