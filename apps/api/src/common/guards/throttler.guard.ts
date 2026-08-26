import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  @Inject(JwtService)
  private readonly jwtService: JwtService;

  @Inject(ConfigService)
  private readonly configService: ConfigService;

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return super.shouldSkip(context);
  }
}
