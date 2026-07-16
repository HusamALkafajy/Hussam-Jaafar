import { Injectable, UnauthorizedException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserRole, AuthProvider, Locale } from '@studyai/types';
import { db } from '@studyai/database';

type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: string;
  authProvider?: string;
  providerId?: string | null;
  emailVerified?: boolean;
  locale?: Locale | string;
  passwordHash?: string | null;
  refreshTokenHash?: string | null;
};
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import { Response } from 'express';

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');

    if (smtpHost && smtpUser && smtpPassword) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          password: smtpPassword,
        },
      } as any);
    }

  }

  async validateUser(email: string, pass: string): Promise<AuthUser | null> {
    const user = await this.usersService.findByEmail(email) as AuthUser | null;
    if (user && user.passwordHash) {
      const isMatch = await bcrypt.compare(pass, user.passwordHash);
      if (isMatch) {
        const { passwordHash, refreshTokenHash, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.password, salt);
    const verificationToken = uuidv4();

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      locale: dto.locale || Locale.EN,
      verificationToken,
      emailVerified: false,
    });

    // Send verification email
    await this.sendVerificationEmail(user.email, user.firstName, verificationToken);

    return this.login(user);
  }

  async login(user: AuthUser) {
    const superAdminEmail = this.configService.get<string>('auth.superAdminEmail');
    if (superAdminEmail && user.email.toLowerCase() === superAdminEmail.toLowerCase() && user.role !== UserRole.ADMIN) {
      const updated = await this.usersService.update(user.id, { role: UserRole.ADMIN });
      user.role = updated.role;
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('auth.jwtSecret'),
      expiresIn: this.configService.get<string>('auth.jwtAccessExpiration') as any,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('auth.jwtRefreshSecret'),
      expiresIn: this.configService.get<string>('auth.jwtRefreshExpiration') as any,
    });


    const salt = await bcrypt.genSalt(12);
    const refreshTokenHash = await bcrypt.hash(refreshToken, salt);
    await this.usersService.updateRefreshTokenHash(user.id, refreshTokenHash);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        locale: user.locale,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('auth.jwtRefreshSecret'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!isMatch) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.login(user);
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshTokenHash(userId, null);
  }

  async verifyEmail(token: string) {
    const user = await this.usersService.findByVerificationToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.usersService.verifyEmail(user.id);
    return { message: 'Email verified successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Return success anyway to avoid user enumeration
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const resetToken = uuidv4();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour expiration

    await this.usersService.saveResetToken(user.id, resetToken, expires);
    await this.sendResetEmail(user.email, user.firstName, resetToken);

    return { message: 'Reset link sent successfully' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByResetToken(dto.token);
    if (!user || !user.resetTokenExpires || user.resetTokenExpires.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.newPassword, salt);

    // All three mutations share one transaction handle (tx).
    // If any step throws, the entire transaction rolls back atomically:
    // no partial state where the password is changed but sessions remain valid.
    await db.transaction(async (tx) => {
      await this.usersService.updatePassword(user.id, passwordHash, tx);
      await this.usersService.updateRefreshTokenHash(user.id, null, tx);
      await this.usersService.clearResetToken(user.id, tx);
    });

    return { message: 'Password reset successfully' };
  }

  async googleLogin(googleUser: { email: string; firstName?: string; lastName?: string; picture?: string; providerId?: string }) {
    let user = (await this.usersService.findByEmail(googleUser.email)) as AuthUser | null;
    if (!user) {
      user = await this.usersService.create({
        email: googleUser.email,
        firstName: googleUser.firstName || '',
        lastName: googleUser.lastName || '',
        avatarUrl: googleUser.picture,
        authProvider: AuthProvider.GOOGLE,
        providerId: googleUser.providerId,
        emailVerified: true,
      });
    } else if (user.authProvider !== AuthProvider.GOOGLE) {
      // Link account or update provider
      await this.usersService.update(user.id, {
        avatarUrl: user.avatarUrl || googleUser.picture,
      });
    }
    return this.login(user as AuthUser);
  }

  async appleLogin(appleUser: { email: string; firstName?: string; lastName?: string; providerId?: string }) {
    let user = (await this.usersService.findByEmail(appleUser.email)) as AuthUser | null;
    if (!user) {
      user = await this.usersService.create({
        email: appleUser.email,
        firstName: appleUser.firstName || '',
        lastName: appleUser.lastName || '',
        authProvider: AuthProvider.APPLE,
        providerId: appleUser.providerId,
        emailVerified: true,
      });
    }
    return this.login(user as AuthUser);
  }

  setAuthCookies(response: Response, tokens: { accessToken: string; refreshToken: string }) {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';

    // Access token is memory-only, do not set it in a cookie.

    response.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Double-submit cookie for basic CSRF mitigation: readable by JS so client can send it in X-CSRF-Token header
    const csrfToken = uuidv4();
    response.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  clearAuthCookies(response: Response) {
    response.clearCookie('refresh_token', { path: '/' });
    response.clearCookie('csrf_token', { path: '/' });
  }

  private async sendVerificationEmail(email: string, name: string, token: string) {
    const url = `${this.configService.get<string>('FRONTEND_URL')}/verify-email?token=${token}`;
    // Do not log tokens or full verification URLs. Log an event instead.
    this.logger.log(`Verification email prepared for ${email}`);

    if (this.transporter) {
      try {
        const from = this.configService.get<string>('SMTP_FROM') || 'StudyAI <noreply@studyai.com>';
        await this.transporter.sendMail({
          from,
          to: email,
          subject: 'Verify your email - StudyAI',
          html: `<p>Hello ${name},</p><p>Please verify your email by clicking <a href="${url}">here</a>.</p>`,
        });
      } catch (e) {
        this.logger.error(`Failed to send verification email to ${email}: ${e.message}`);
      }
    }
  }

  private async sendResetEmail(email: string, name: string, token: string) {
    const url = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${token}`;
    // Do not log tokens or full reset URLs. Log an event instead.
    this.logger.log(`Password reset email prepared for ${email}`);

    if (this.transporter) {
      const from = this.configService.get<string>('SMTP_FROM') || 'StudyAI <noreply@studyai.com>';
      await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Reset your password — StudyAI',
        html: `<p>Hello ${name},</p><p>You can reset your password by clicking <a href="${url}">here</a>.</p>`,
      });
    }
  }
}
