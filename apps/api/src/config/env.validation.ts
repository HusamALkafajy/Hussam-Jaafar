import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsString, IsOptional, validateSync, MinLength } from 'class-validator';
import { StructuredLogger } from '../common/logging/structured-logger';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 4000;

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
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

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
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    const errorMessages = errors.map((err) => {
      return Object.values(err.constraints || {}).join(', ');
    });
    
    // Fail fast on mandatory errors
    throw new Error(`\n❌ Configuration Validation Failed:\n- ${errorMessages.join('\n- ')}\n\nPlease check your .env file.`);
  }

  // Handle optional/deployment-mode-specific warnings
  const warnings: string[] = [];
  
  if (!validatedConfig.GOOGLE_CLIENT_ID || !validatedConfig.GOOGLE_CLIENT_SECRET) {
    if (validatedConfig.NODE_ENV === Environment.Production) {
      throw new Error(`\n❌ Configuration Validation Failed:\n- Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are mandatory in production.\n\nPlease check your .env file.`);
    } else {
      warnings.push('Google OAuth credentials are missing. Google SSO will not work.');
    }
  }

  if (!validatedConfig.STRIPE_SECRET_KEY) {
    warnings.push('STRIPE_SECRET_KEY is missing. Payments will not work.');
  }

  if (!validatedConfig.GEMINI_API_KEY && !validatedConfig.OPENAI_API_KEY) {
    warnings.push('AI Provider API keys (GEMINI_API_KEY or OPENAI_API_KEY) are missing. Core AI generation features will fail.');
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
