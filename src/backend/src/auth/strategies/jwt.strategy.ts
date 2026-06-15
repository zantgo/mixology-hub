import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService } from '../auth.service';

interface JwtValidatePayload {
  sub: string;
  tokenVersion?: number;
  saltVersion?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
      passReqToCallback: true,
    } as any);
  }

  async validate(request: Request, payload: JwtValidatePayload) {
    // Extract token from request
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);

    // Validate user and check token blacklist using actual token string
    const user = await this.authService.validateUser(payload, token!);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Add token to user object for potential blacklisting in controllers
    // Only whitelist safe fields — never expose passwordHash, refreshToken, etc.
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      token,
    };
  }
}
