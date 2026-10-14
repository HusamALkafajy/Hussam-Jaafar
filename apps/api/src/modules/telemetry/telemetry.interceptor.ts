import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { ConfigService } from '@nestjs/config';
import { StructuredLogger } from '../../common/logging/structured-logger';

type TelemetryErrorCategory = 'timeout' | 'http_exception' | 'application_error' | 'unknown_error';

@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  private readonly logger: StructuredLogger;

  constructor(
    @InjectMetric('studyai_http_requests_total')
    private readonly httpRequestsTotal: Counter<string>,
    @InjectMetric('studyai_http_request_duration_seconds')
    private readonly httpRequestDuration: Histogram<string>,
    @InjectMetric('studyai_operational_events_total')
    private readonly operationalEventsTotal: Counter<string>,
    configService: ConfigService,
  ) {
    this.logger = new StructuredLogger(configService.get('NODE_ENV') === 'production', 'Telemetry');
  }

  private normalizePath(request: Request): string {
    const routePath = typeof request.route?.path === 'string' ? request.route.path : undefined;
    const path = routePath
      ? `${request.baseUrl || ''}${routePath}`
      : (request.path || request.url || '/').split(/[?#]/, 1)[0];

    return path
      .replace(
        /\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/gi,
        ':id',
      )
      .replace(/\/[0-9]+(?=\/|$)/g, '/:id')
      .replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id')
      .replace(/\/[0-9A-HJKMNP-TV-Z]{26}(?=\/|$)/gi, '/:id');
  }

  private statusFrom(error: unknown): number {
    if (typeof (error as { getStatus?: unknown })?.getStatus === 'function') {
      const status = (error as { getStatus: () => unknown }).getStatus();
      if (typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599) {
        return status;
      }
    }

    return 500;
  }

  private errorCategory(error: unknown, statusCode: number): TelemetryErrorCategory {
    if (
      statusCode === 408 ||
      statusCode === 504 ||
      (error as { name?: unknown })?.name === 'TimeoutError'
    ) {
      return 'timeout';
    }
    if (typeof (error as { getStatus?: unknown })?.getStatus === 'function') {
      return 'http_exception';
    }
    if (error instanceof Error) {
      return 'application_error';
    }
    return 'unknown_error';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method } = request;
    const startTime = Date.now();
    const normalizedPath = this.normalizePath(request);

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startTime;
        const durationSeconds = durationMs / 1000;
        const statusCode = response.statusCode;
        const statusLabel = statusCode.toString();
        
        try {
          this.httpRequestsTotal.labels(method, normalizedPath, statusLabel).inc();
          this.httpRequestDuration.labels(method, normalizedPath).observe(durationSeconds);
        } catch {
          // Fail silently on metric emission error
        }
        
        this.logger.log({
          event: 'http.request.completed',
          reasonCode: 'request_completed',
          method,
          route: normalizedPath,
          statusCode,
          durationMs,
        });
        
        // Specific KPI triggers based on endpoint and status
        if (statusCode === 201 && normalizedPath.includes('/files/upload')) {
          this.logger.log({ event: 'product.activation', reasonCode: 'document_uploaded' });
        }
        if (statusCode === 201 && normalizedPath.includes('/chat')) {
          this.logger.log({ event: 'product.ai_tutor_used', reasonCode: 'chat_created' });
        }
        if (statusCode === 201 && normalizedPath.includes('/exams/submit')) {
          this.logger.log({ event: 'product.quiz_completed', reasonCode: 'exam_submitted' });
        }
        if (statusCode === 201 && normalizedPath.includes('/flashcards/review')) {
          this.logger.log({ event: 'product.revision_completed', reasonCode: 'review_submitted' });
        }
        if (statusCode === 200 && normalizedPath.includes('/auth/reset-password')) {
          this.logger.log({ event: 'auth.password_reset', reasonCode: 'password_reset_completed' });
          this.operationalEventsTotal.labels('password_reset').inc();
        }
      }),
      catchError((error) => {
        const durationMs = Date.now() - startTime;
        const durationSeconds = durationMs / 1000;
        const statusCode = this.statusFrom(error);
        const statusLabel = statusCode.toString();
        const errorCategory = this.errorCategory(error, statusCode);
        
        try {
          this.httpRequestsTotal.labels(method, normalizedPath, statusLabel).inc();
          this.httpRequestDuration.labels(method, normalizedPath).observe(durationSeconds);
        } catch {}

        this.logger.error({
          event: 'http.request.failed',
          reasonCode: 'request_failed',
          method,
          route: normalizedPath,
          statusCode,
          durationMs,
          errorCategory,
        });
        
        if (statusCode === 429) {
          this.logger.warn({
            event: 'operational.quota_exhausted',
            reasonCode: 'rate_or_quota_limit',
            method,
            route: normalizedPath,
            statusCode,
          });
          try { this.operationalEventsTotal.labels('quota_exhaustion').inc(); } catch {}
        }
        if (statusCode === 401 && normalizedPath.includes('/auth/login')) {
          this.logger.warn({
            event: 'auth.login_failed',
            reasonCode: 'authentication_rejected',
            method,
            route: normalizedPath,
            statusCode,
          });
          try { this.operationalEventsTotal.labels('auth_failure').inc(); } catch {}
        }
        if (errorCategory === 'timeout') {
          this.logger.warn({
            event: 'operational.timeout',
            reasonCode: 'request_timeout',
            method,
            route: normalizedPath,
            statusCode,
          });
          try { this.operationalEventsTotal.labels('ai_timeout').inc(); } catch {}
        }
        
        return throwError(() => error);
      })
    );
  }
}
