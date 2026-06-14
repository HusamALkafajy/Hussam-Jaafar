import { Controller, Post, Get, Body, Req, Res, UseGuards, Query, Param, HttpCode, HttpStatus, All } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';
import { UserProfileResponse } from '@studyai/types';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.authService.setAuthCookies(res, result);
    return { user: result.user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.validateUser(dto.email, dto.password);
    if (!result) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid credentials',
      });
    }
    const logged = await this.authService.login(result);
    this.authService.setAuthCookies(res, logged);
    return { user: logged.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('sub') userId: string, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(userId);
    this.authService.clearAuthCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'No refresh token provided',
      });
    }
    const result = await this.authService.refresh(refreshToken);
    this.authService.setAuthCookies(res, result);
    return { user: result.user };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: Request & { user?: { email: string; firstName?: string; lastName?: string; picture?: string; id?: string } }, @Res() res: Response) {
    if (!req.user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: 'Authentication failed' });
    }
    const logged = await this.authService.googleLogin({
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      picture: req.user.picture,
      providerId: req.user.id,
    });
    this.authService.setAuthCookies(res, logged);
    // Redirect to frontend dashboard
    const frontendUrl = this.authService['configService'].get<string>('FRONTEND_URL') || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard`);
  }

  @Public()
  @Get('apple')
  @UseGuards(AuthGuard('apple'))
  async appleAuth() {
    // Redirects to Apple
  }

  @Public()
  @All('apple/callback')
  @UseGuards(AuthGuard('apple'))
  async appleAuthCallback(@Req() req: Request & { user?: { email: string; firstName?: string; lastName?: string; id?: string } }, @Res() res: Response) {
    if (!req.user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: 'Authentication failed' });
    }
    const logged = await this.authService.appleLogin({
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      providerId: req.user.id,
    });
    this.authService.setAuthCookies(res, logged);
    const frontendUrl = this.authService['configService'].get<string>('FRONTEND_URL') || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard`);
  }

  @Get('me')
  async getMe(@CurrentUser() user: UserProfileResponse) {
    return { user };
  }
}
