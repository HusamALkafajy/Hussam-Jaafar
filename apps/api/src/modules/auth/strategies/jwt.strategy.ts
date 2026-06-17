import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => {
          let data = null;
          if (request && request.cookies) {
            data = request.cookies['access_token'];
          }
          return data;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('auth.jwtSecret') || 'your-jwt-secret-change-in-production-min-32-chars',
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    console.log('[JwtStrategy Debug] Validating payload:', JSON.stringify(payload));
    let user;
    try {
      user = await this.usersService.findById(payload.sub);
      console.log('[JwtStrategy Debug] User query result:', user ? `Found id=${user.id} email=${user.email} isActive=${user.isActive}` : 'Not found');
    } catch (err) {
      console.error('[JwtStrategy Debug] usersService.findById failed with error:', err);
      // Convert not-found or other errors into Unauthorized to avoid leaking existence
      throw new UnauthorizedException('User account is inactive or not found');
    }
    if (!user || !user.isActive) {
      console.warn('[JwtStrategy Debug] Validation failed. User null or inactive:', !user ? 'User null' : `isActive=${user.isActive}`);
      throw new UnauthorizedException('User account is inactive or not found');
    }
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      locale: user.locale,
    };
  }
}
