import { UserRole, AuthProvider, Locale, UserProfileResponse } from './user.types';

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  locale?: Locale;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfileResponse;
}

export interface AuthUserPayload {
  sub: string;
  email: string;
  role: string;
}
