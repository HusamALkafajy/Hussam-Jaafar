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
    let user;
    try {
      user = await this.usersService.findById(payload.sub);
    } catch (err) {
      // Convert not-found or other errors into Unauthorized to avoid leaking existence
      throw new UnauthorizedException('User account is inactive or not found');
    }
    if (!user || !user.isActive) {
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
