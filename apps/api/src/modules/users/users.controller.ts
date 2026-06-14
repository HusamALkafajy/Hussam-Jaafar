import { Controller, Get, Patch, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';
import * as bcrypt from 'bcrypt';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser('sub') userId: string) {
    const user = await this.usersService.findById(userId);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      locale: user.locale,
      subscriptionTier: user.subscriptionTier,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  @Patch('profile')
  async updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersService.update(userId, dto);
    return {
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      avatarUrl: updated.avatarUrl,
    };
  }

  @Patch('password')
  async changePassword(@CurrentUser('sub') userId: string, @Body() dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user.passwordHash) {
      throw new BadRequestException('OAuth users cannot change password directly');
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Incorrect old password');
    }

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(dto.newPassword, salt);
    await this.usersService.updatePassword(userId, hash);

    return { message: 'Password changed successfully' };
  }

  @Patch('locale')
  async updateLocale(@CurrentUser('sub') userId: string, @Body() dto: UpdateLocaleDto) {
    await this.usersService.updateLocale(userId, dto.locale);
    return { message: 'Locale updated successfully', locale: dto.locale };
  }
}
