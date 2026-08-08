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
    const request = context.switchToHttp().getRequest();
    
    // Extract JWT token
    let token = null;
    const authHeader = request.headers?.authorization;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.substring(7);
    }

    if (token) {
      try {
        const secret = this.configService.getOrThrow<string>('auth.jwtSecret');
        const payload = await this.jwtService.verifyAsync(token, { secret });
        if (payload && payload.role === 'ADMIN') {
          return true; // Bypass rate limiting for ADMIN
        }
      } catch (err) {
        // Ignore token verification errors (let JwtAuthGuard handle it)
      }
    }

    return super.shouldSkip(context);
  }
}
