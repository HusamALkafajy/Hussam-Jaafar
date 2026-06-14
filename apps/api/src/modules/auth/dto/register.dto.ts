import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { Locale } from '@studyai/types';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  firstName!: string;

  @IsString()
  @MinLength(2)
  lastName!: string;

  @IsEnum(Locale)
  @IsOptional()
  locale?: Locale;
}
