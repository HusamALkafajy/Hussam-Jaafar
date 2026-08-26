import { Module, Global } from '@nestjs/common';
import { PrometheusModule, makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { TelemetryInterceptor } from './telemetry.interceptor';

export const httpRequestsTotalProvider = makeCounterProvider({
  name: 'studyai_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path_route', 'status_code'],
});

export const httpRequestDurationProvider = makeHistogramProvider({
  name: 'studyai_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path_route'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 15, 30],
});

export const operationalEventsTotalProvider = makeCounterProvider({
  name: 'studyai_operational_events_total',
  help: 'Total number of operational events',
  labelNames: ['event_type'],
});

export const workerJobsTotalProvider = makeCounterProvider({
  name: 'studyai_worker_jobs_total',
  help: 'Total number of worker jobs processed',
  labelNames: ['status', 'error_code'],
});

export const workerCheckpointJobsTotalProvider = makeCounterProvider({
  name: 'studyai_worker_checkpoint_jobs_total',
  help: 'Total number of individual checkpoint processing jobs',
  labelNames: ['status', 'error_type'],
});

export const workerOcrDurationProvider = makeHistogramProvider({
  name: 'studyai_worker_ocr_duration_seconds',
  help: 'Latency of OCR text extraction',
  labelNames: ['status'],
  buckets: [0.5, 1, 2.5, 5, 10, 20, 30, 60],
});

export const workerEmbeddingDurationProvider = makeHistogramProvider({
  name: 'studyai_worker_embedding_duration_seconds',
  help: 'Latency of embedding generation',
  labelNames: ['status'],
  buckets: [0.5, 1, 2.5, 5, 10, 20, 30, 60],
});

export const workerDbTxDurationProvider = makeHistogramProvider({
  name: 'studyai_worker_transaction_duration_seconds',
  help: 'Duration of PostgreSQL transaction during checkpoint completion',
  labelNames: ['status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
});

@Global()
@Module({
  imports: [PrometheusModule.register({ defaultMetrics: { enabled: false } })],
  providers: [
    httpRequestsTotalProvider,
    httpRequestDurationProvider,
    operationalEventsTotalProvider,
    workerJobsTotalProvider,
    workerCheckpointJobsTotalProvider,
    workerOcrDurationProvider,
    workerEmbeddingDurationProvider,
    workerDbTxDurationProvider,
    TelemetryInterceptor,
  ],
  exports: [
    httpRequestsTotalProvider,
    httpRequestDurationProvider,
    operationalEventsTotalProvider,
    workerJobsTotalProvider,
    workerCheckpointJobsTotalProvider,
    workerOcrDurationProvider,
    workerEmbeddingDurationProvider,
    workerDbTxDurationProvider,
    TelemetryInterceptor,
  ],
})
export class TelemetryModule {}
