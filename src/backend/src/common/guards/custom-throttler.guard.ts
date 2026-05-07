import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerRequest } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const request = requestProps.context.switchToHttp().getRequest();

    if (
      request.headers['x-test-bypass-ratelimit'] &&
      process.env.NODE_ENV === 'test'
    ) {
      return true;
    }

    return super.handleRequest(requestProps);
  }
}
