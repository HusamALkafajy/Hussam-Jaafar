import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('auth.jwtSecret'),
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    let user;
    try {
      user = await this.usersService.findById(payload.sub);
    } catch (err) {
      this.logger.error('JWT user lookup failed', err);
      // Convert not-found or other errors into Unauthorized to avoid leaking existence
      throw new UnauthorizedException('User account is inactive or not found');
    }
    if (!user || !user.isActive) {
      this.logger.warn('JWT validation rejected an inactive or missing user');
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
