import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(request: any, payload: any) {
    // Extract token from request
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);
    
    // Validate user and check token blacklist
    const user = await this.authService.validateUser(payload);
    
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Add token to user object for potential blacklisting in controllers
    return {
      ...user,
      token,
    };
  }
}