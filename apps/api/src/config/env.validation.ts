import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  Max,
  Min,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  validateSync,
} from 'class-validator';
import { StructuredLogger } from '../common/logging/structured-logger';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export const DEFAULT_THROTTLE_LIMIT = 100;
export const DEFAULT_THROTTLE_TTL_MS = 60_000;

// @nestjs/throttler 6.5.0 passes ttl directly to setTimeout. Node.js timers
// clamp delays above this signed 32-bit value, so larger values are unsafe.
export const MAX_THROTTLE_TTL_MS = 2_147_483_647;

const POSITIVE_BASE_10_INTEGER = /^[1-9]\d*$/;

function normalizeThrottleValue(
  config: Record<string, unknown>,
  name: 'THROTTLE_LIMIT' | 'THROTTLE_TTL',
  maximum: number,
): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(config, name)) return undefined;

  const raw = config[name];
  const value = typeof raw === 'number' ? String(raw) : raw;
  if (typeof value !== 'string' || !POSITIVE_BASE_10_INTEGER.test(value)) {
    return `${name} must be a base-10 positive integer.`;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    return `${name} must be a safe positive integer no greater than ${maximum}.`;
  }

  config[name] = parsed;
  return undefined;
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 4000;

  @IsNumber()
  @IsOptional()
  APP_PORT?: number;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  @IsOptional()
  THROTTLE_LIMIT?: number;

  @IsInt()
  @Min(1)
  @Max(MAX_THROTTLE_TTL_MS)
  @IsOptional()
  THROTTLE_TTL?: number;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters long' })
  JWT_SECRET!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters long' })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  REDIS_URL?: string;

  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsNumber()
  @IsOptional()
  REDIS_PORT?: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  @IsOptional()
  FRONTEND_URL?: string;

  @IsString()
  @IsOptional()
  STORAGE_PATH?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  APPLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  APPLE_TEAM_ID?: string;

  @IsString()
  @IsOptional()
  APPLE_KEY_ID?: string;

  @IsString()
  @IsOptional()
  APPLE_PRIVATE_KEY?: string;

  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  GEMINI_API_KEY?: string;

  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;
}

export function validate(config: Record<string, unknown>) {
  const throttleErrors = [
    normalizeThrottleValue(config, 'THROTTLE_LIMIT', Number.MAX_SAFE_INTEGER),
    normalizeThrottleValue(config, 'THROTTLE_TTL', MAX_THROTTLE_TTL_MS),
  ].filter((message): message is string => Boolean(message));

  if (throttleErrors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n- ${throttleErrors.join('\n- ')}\n\nPlease check your environment.`,
    );
  }

  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    const errorMessages = errors.map((error) =>
      Object.values(error.constraints || {}).join(', '),
    );

    throw new Error(
      `Configuration validation failed:\n- ${errorMessages.join('\n- ')}\n\nPlease check your environment.`,
    );
  }

  const deploymentErrors: string[] = [];
  const warnings: string[] = [];

  if (validatedConfig.NODE_ENV === Environment.Production) {
    const hasRedisUrl = Boolean(validatedConfig.REDIS_URL);
    const hasRedisHostContract = Boolean(
      validatedConfig.REDIS_HOST &&
        validatedConfig.REDIS_PORT &&
        validatedConfig.REDIS_PASSWORD,
    );
    if (!hasRedisUrl && !hasRedisHostContract) {
      deploymentErrors.push(
        'Production Redis requires REDIS_URL or REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD.',
      );
    }
    if (!validatedConfig.FRONTEND_URL) deploymentErrors.push('FRONTEND_URL is required in production.');
    if (!validatedConfig.STORAGE_PATH) deploymentErrors.push('STORAGE_PATH is required in production.');
  }

  const googleValues = [validatedConfig.GOOGLE_CLIENT_ID, validatedConfig.GOOGLE_CLIENT_SECRET];
  const configuredGoogleValues = googleValues.filter(Boolean).length;
  if (configuredGoogleValues > 0 && configuredGoogleValues < googleValues.length) {
    deploymentErrors.push('Google OAuth requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  } else if (configuredGoogleValues === 0) {
    warnings.push('Google OAuth is disabled because its optional credentials are missing.');
  }

  const appleValues = [
    validatedConfig.APPLE_CLIENT_ID,
    validatedConfig.APPLE_TEAM_ID,
    validatedConfig.APPLE_KEY_ID,
    validatedConfig.APPLE_PRIVATE_KEY,
  ];
  const configuredAppleValues = appleValues.filter(Boolean).length;
  if (configuredAppleValues > 0 && configuredAppleValues < appleValues.length) {
    deploymentErrors.push('Apple OAuth requires its complete credential set when enabled.');
  } else if (configuredAppleValues === 0) {
    warnings.push('Apple OAuth is disabled because its optional credentials are missing.');
  }

  if (deploymentErrors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n- ${deploymentErrors.join('\n- ')}\n\nPlease check your environment.`,
    );
  }

  if (!validatedConfig.STRIPE_SECRET_KEY) {
    warnings.push('STRIPE_SECRET_KEY is missing. Payments will not work.');
  }

  if (!validatedConfig.GEMINI_API_KEY && !validatedConfig.OPENAI_API_KEY) {
    warnings.push(
      'AI Provider API keys (GEMINI_API_KEY or OPENAI_API_KEY) are missing. Core AI generation features will fail.',
    );
  }

  if (warnings.length > 0) {
    const logger = new StructuredLogger(
      validatedConfig.NODE_ENV === Environment.Production,
      'EnvironmentValidation',
    );
    logger.warn('Optional configuration is incomplete', { warnings });
  }

  return validatedConfig;
}
