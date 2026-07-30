import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { TelemetryInterceptor } from './modules/telemetry/telemetry.interceptor';
import { requestContextMiddleware } from './common/request-context';
import { StructuredLogger } from './common/logging/structured-logger';
import { reportBootstrapFailure } from './common/bootstrap/bootstrap-failure';

// Bootstrap runs before ConfigService is available to dependency injection.
// eslint-disable-next-line no-restricted-syntax
const appLogger = new StructuredLogger(process.env.NODE_ENV === 'production');

export async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: appLogger,
    abortOnError: false,
  });
  const configService = app.get(ConfigService);

  // Stripe webhook needs raw body for signature verification — must be before other body parsers
  app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

  const port = configService.get<number>('app.port') || 4000;
  const frontendUrl = configService.get<string>('app.frontendUrl') || 'http://localhost:3000';

  // 1. Security & Parsing Middleware
  app.use(requestContextMiddleware);
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
    origin: [frontendUrl, 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-CSRF-Token',
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
  app.useGlobalFilters(new HttpExceptionFilter(appLogger));
  app.useGlobalInterceptors(new TransformInterceptor());

  const telemetryInterceptor = app.get(TelemetryInterceptor);
  app.useGlobalInterceptors(telemetryInterceptor);

  // 6. Increase request timeouts for longer AI provider response times
  const extendedTimeout = 10 * 60 * 1000; // 10 minutes
  const server = app.getHttpServer();
  if (server && typeof server.setTimeout === 'function') {
    server.setTimeout(extendedTimeout);
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (typeof req.setTimeout === 'function') {
      req.setTimeout(extendedTimeout);
    }
    if (typeof res.setTimeout === 'function') {
      res.setTimeout(extendedTimeout);
    }
    next();
  });

  await app.listen(port);
  appLogger.log(`StudyAI NestJS API Gateway successfully running on port: ${port}`);
  appLogger.log(`CORS allowed origins configured for: ${frontendUrl}`);
}

export function startApi(): void {
  void bootstrap().catch((error: unknown) => {
    reportBootstrapFailure(error, appLogger);
  });
}

if (require.main === module) {
  startApi();
}
