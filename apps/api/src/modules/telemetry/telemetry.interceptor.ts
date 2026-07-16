import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Telemetry');

  constructor(
    @InjectMetric('studyai_http_requests_total')
    private readonly httpRequestsTotal: Counter<string>,
    @InjectMetric('studyai_http_request_duration_seconds')
    private readonly httpRequestDuration: Histogram<string>,
    @InjectMetric('studyai_operational_events_total')
    private readonly operationalEventsTotal: Counter<string>,
  ) {}

  private normalizePath(url: string): string {
    // Basic route normalization to prevent label cardinality explosion
    // Replaces UUIDs with :id
    return url.replace(/\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/ig, ':id');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, url } = request;
    const startTime = Date.now();

    const normalizedPath = this.normalizePath(url);

    // Extract user ID if available (assumes JWT auth sets req.user)
    const userId = (request as any).user?.id || 'anonymous';

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = response.statusCode.toString();
        
        try {
          this.httpRequestsTotal.labels(method, normalizedPath, statusCode).inc();
          this.httpRequestDuration.labels(method, normalizedPath).observe(duration);
        } catch (e) {
          // Fail silently on metric emission error
        }
        
        // Log successful operations for KPI tracking
        this.logger.log(`[KPI] ${method} ${url} ${statusCode} ${duration}s user=${userId}`);
        
        // Specific KPI triggers based on endpoint and status
        if (statusCode === '201' && url.includes('/files/upload')) {
          this.logger.log(`[KPI_ACTIVATION] user=${userId} uploaded document successfully.`);
        }
        if (statusCode === '201' && url.includes('/chat')) {
          this.logger.log(`[KPI_AI_TUTOR_USAGE] user=${userId} interacted with AI Tutor.`);
        }
        if (statusCode === '201' && url.includes('/exams/submit')) {
          this.logger.log(`[KPI_QUIZ_COMPLETION] user=${userId} completed a quiz.`);
        }
        if (statusCode === '201' && url.includes('/flashcards/review')) {
          this.logger.log(`[KPI_REVISION_COMPLETION] user=${userId} completed a revision.`);
        }
        if (statusCode === '200' && url.includes('/auth/reset-password')) {
          this.logger.log(`[KPI_PASSWORD_RESET_SUCCESS] anonymous user reset password.`);
          this.operationalEventsTotal.labels('password_reset').inc();
        }
      }),
      catchError((error) => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = error.getStatus ? error.getStatus().toString() : '500';
        
        try {
          this.httpRequestsTotal.labels(method, normalizedPath, statusCode).inc();
          this.httpRequestDuration.labels(method, normalizedPath).observe(duration);
        } catch (e) {}

        this.logger.error(`[KPI_ERROR] ${method} ${url} ${statusCode} ${duration}s user=${userId} err=${error.message}`);
        
        if (statusCode === '429') {
          this.logger.warn(`[KPI_QUOTA_EXHAUSTION] user=${userId} hit rate/quota limits at ${url}.`);
          try { this.operationalEventsTotal.labels('quota_exhaustion').inc(); } catch (e) {}
        }
        if (statusCode === '401' && url.includes('/auth/login')) {
          this.logger.warn(`[KPI_AUTH_FAILURE] Failed login attempt for user=${userId}.`);
          try { this.operationalEventsTotal.labels('auth_failure').inc(); } catch (e) {}
        }
        if (statusCode === '408' || statusCode === '504' || error.name === 'TimeoutError') {
          this.logger.warn(`[KPI_TIMEOUT_EVENT] Timeout at ${url} for user=${userId}.`);
          try { this.operationalEventsTotal.labels('ai_timeout').inc(); } catch (e) {}
        }
        
        return throwError(() => error);
      })
    );
  }
}
