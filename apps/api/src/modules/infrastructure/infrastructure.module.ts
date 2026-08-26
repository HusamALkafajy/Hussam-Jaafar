import { Global, Module, OnModuleInit, OnApplicationShutdown, OnApplicationBootstrap, Inject, Injectable, Logger } from '@nestjs/common';
import { InfrastructureBootstrap, PrismaClient } from '@studyai/infrastructure';
import { client } from '@studyai/database';

@Injectable()
export class InfrastructureLifecycleService implements OnModuleInit, OnApplicationShutdown, OnApplicationBootstrap {
  private readonly logger = new Logger(InfrastructureLifecycleService.name);

  constructor(
    @Inject('PrismaClient') private readonly prisma: PrismaClient,
    @Inject('RedisClient') private readonly redis: any,
    @Inject('RawQueue') private readonly queue: any,
    @Inject('IWorkerRuntimeEngine') private readonly workerEngine: any
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Starting Worker Engine...');
    await this.workerEngine.start();
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onApplicationShutdown() {
    this.logger.log('Initiating infrastructure shutdown...');
    const tasks: Promise<any>[] = [];

    // 1. Prisma
    tasks.push(this.prisma.$disconnect());

    // 2. Redis
    if (this.redis && this.redis.status !== 'end') {
      tasks.push(this.redis.quit());
    }

    // Stop Worker Engine first
    if (this.workerEngine) {
      tasks.push(this.workerEngine.stop());
    }

    // 3. BullMQ Queue
    if (this.queue && typeof this.queue.close === 'function') {
      tasks.push(this.queue.close());
    }

    // 4. Postgres (Drizzle client)
    tasks.push(client.end());

    // Execute concurrently and guarantee idempotency
    const results = await Promise.allSettled(tasks);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(`Infrastructure shutdown task ${index} failed:`, result.reason);
      }
    });

    this.logger.log('Infrastructure shutdown complete.');
  }
}

// Generate providers via Composition Root
const generatedProviders = InfrastructureBootstrap.boot();

import { HealthController } from './health.controller';

@Global()
@Module({
  controllers: [HealthController],
  providers: [
    ...generatedProviders,
    InfrastructureLifecycleService
  ],
  exports: [
    'PrismaClient',
    'IConfigurationProvider',
    'IHealthProvider',
    'IStorageProvider',
    'IObjectStorage',
    'ILogger',
    'IMetrics',
    'ITracer',
    'IEventDispatcher',
    'IEventOutbox',
    'IQueue',
    'IJobDispatcher',
    'IWorkerRegistry',
    'IWorkerRuntimeEngine',
    'ILearningRepository',
    'IWorkflowRepository',
    'IStudyPlanRepository',
    'IAssessmentRepository',
    'IRevisionRepository',
    'IAnalyticsRepository',
    'ISecurityRepository',
    'IIntegrationRepository',
    'IRecommendationRepository',
    'IAssetRepository',
    'IDomainCacheService',
    'TokenAccountant',
  ],
})
export class InfrastructureModule {}
