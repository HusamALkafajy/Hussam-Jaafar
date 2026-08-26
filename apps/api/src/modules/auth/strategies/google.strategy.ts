import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly oauthConfigured: boolean;

  constructor(config: ConfigService) {
    const configuredClientId = config.get<string>('auth.googleClientId');
    const configuredClientSecret = config.get<string>('auth.googleClientSecret');
    const clientID = configuredClientId || 'oauth-disabled';
    const clientSecret = configuredClientSecret || 'oauth-disabled';
    const callbackURL = config.get<string>('auth.googleCallbackUrl');

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });

    this.oauthConfigured = Boolean(configuredClientId && configuredClientSecret);
  }

  authenticate(req: any, options?: any): void {
    if (!this.oauthConfigured) {
      this.fail({ message: 'Google OAuth is not configured.' }, 503);
      return;
    }

    super.authenticate(req, options);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const user = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName || '',
      picture: photos[0].value,
      accessToken,
      providerId: profile.id,
    };
    done(null, user);
  }
}
