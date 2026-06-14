import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom, isObservable } from 'rxjs';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { User } from '../../users/entities/user.entity';

interface GuardRequest extends Request {
  user?: User;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const mockAuthEnabled =
      this.configService.get<string>('ENABLE_MOCK_AUTH') === 'true';

    let user: User | null = null;
    const request = context.switchToHttp().getRequest<GuardRequest>();

    if (mockAuthEnabled) {
      const mockEmail = this.configService.get<string>(
        'MOCK_USER_EMAIL',
        'mock@test.com',
      );
      user = await this.userRepository.findOne({
        where: { email: mockEmail },
      });
      if (user) {
        request.user = user;
      } else {
        throw new UnauthorizedException(
          'Mock user not found. Waiting for seeder.',
        );
      }
    } else {
      const result = super.canActivate(context);
      const canActivate = isObservable(result)
        ? await firstValueFrom(result)
        : await result;
      if (!canActivate) {
        return false;
      }
      user = request.user as User | null;
    }

    if (user && !user.emailVerified) {
      const gracePeriodMs = 24 * 60 * 60 * 1000;
      const elapsedMs = Date.now() - new Date(user.createdAt).getTime();
      const isMutatingRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
        request.method,
      );

      if (elapsedMs > gracePeriodMs) {
        throw new ForbiddenException(
          'Email verification required. Your 24-hour grace period has expired.',
        );
      }

      if (isMutatingRequest) {
        throw new ForbiddenException(
          'Email verification required. You cannot perform modifications during the grace period.',
        );
      }
    }

    return true;
  }

  handleRequest(err: unknown, user: User | null): any {
    if (err || !user) {
      throw err instanceof Error
        ? err
        : new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
