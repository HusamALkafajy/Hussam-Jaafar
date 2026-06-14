import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  // Enforce presence and minimal strength of JWT secrets at startup.
  const jwtSecret = configService.get<string>('auth.jwtSecret');
  const jwtRefreshSecret = configService.get<string>('auth.jwtRefreshSecret');
  if (!jwtSecret || jwtSecret.length < 32 || !jwtRefreshSecret || jwtRefreshSecret.length < 32) {
    logger.error(
      'JWT secrets are missing or too weak. Ensure auth.jwtSecret and auth.jwtRefreshSecret are set and at least 32 characters.'
    );
    throw new Error('Invalid JWT secrets configuration.');
  }

  // Stripe webhook needs raw body for signature verification — must be before other body parsers
  app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

  const port = configService.get<number>('app.port') || 4000;
  const frontendUrl = configService.get<string>('app.frontendUrl') || 'http://localhost:3000';

  // 1. Security & Parsing Middleware
  app.use(helmet());
  app.use(cookieParser());

  // Simple double-submit CSRF protection middleware for state-changing requests.
  // Expects client to read `csrf_token` cookie and send it in `X-CSRF-Token` header.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const method = req.method && req.method.toUpperCase();
    const csrfRequired = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!csrfRequired) return next();

    // Only require CSRF for requests where the client already has an access token (authenticated)
    const hasAccessCookie = !!(req.cookies && req.cookies['access_token']);
    if (!hasAccessCookie) return next();

    const headerToken = req.get('x-csrf-token');
    const cookieToken = req.cookies && req.cookies['csrf_token'];

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      return res.status(403).json({ success: false, message: 'Invalid CSRF token' });
    }
    return next();
  });

  // 2. CORS
  app.enableCors({
    origin: [frontendUrl],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // 3. Global prefix
  app.setGlobalPrefix('api');

  // 4. Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 5. Global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.listen(port);
  logger.log(`StudyAI NestJS API Gateway successfully running on port: ${port}`);
  logger.log(`CORS allowed origins configured for: ${frontendUrl}`);
}
bootstrap();
