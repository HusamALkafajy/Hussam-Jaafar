import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  // Require explicit secrets via environment variables. Do not fall back to insecure defaults.
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
  appleClientId: process.env.APPLE_CLIENT_ID,
  appleTeamId: process.env.APPLE_TEAM_ID,
  appleKeyId: process.env.APPLE_KEY_ID,
  applePrivateKey: process.env.APPLE_PRIVATE_KEY,
  appleCallbackUrl: process.env.APPLE_CALLBACK_URL || 'http://localhost:4000/api/auth/apple/callback',
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL,
}));
