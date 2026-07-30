import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  private readonly logger = new Logger(AppleStrategy.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  authenticate(this: any, req: any, options?: any) {
    const code = req.query?.code || req.body?.code;

    if (code) {
      // Callback handling (Extract user details)
      let email = 'apple-user@studyai.com';
      let firstName = 'Apple';
      let lastName = 'User';
      const providerId = 'apple-mock-id-12345';

      if (req.body?.user) {
        try {
          const userData = JSON.parse(req.body.user);
          email = userData.email || email;
          firstName = userData.name?.firstName || firstName;
          lastName = userData.name?.lastName || lastName;
        } catch (error) {
          this.logger.warn('Apple user profile payload parsing failed', error);
        }
      }

      const user = {
        email,
        firstName,
        lastName,
        providerId,
      };

      // Call passport success method to authenticate the request
      this.success(user);
    } else {
      // Authorize redirection phase
      const callbackURL = this.configService.get('auth.appleCallbackUrl') || 'http://localhost:4000/api/auth/apple/callback';
      const redirectUrl = `${callbackURL}?code=mock_apple_code`;
      this.redirect(redirectUrl);
    }
  }

  validate(payload: any) {
    return payload;
  }
}
