import { registerAs } from '@nestjs/config';
import { DEFAULT_THROTTLE_LIMIT, DEFAULT_THROTTLE_TTL_MS } from './env.validation';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.APP_PORT || '4000', 10),
  url: process.env.APP_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  throttleLimit: Number(process.env.THROTTLE_LIMIT ?? DEFAULT_THROTTLE_LIMIT),
  throttleTtl: Number(process.env.THROTTLE_TTL ?? DEFAULT_THROTTLE_TTL_MS),
}));
