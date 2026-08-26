import { IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail()
  email!: string;
}
