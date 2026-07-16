import { ModuleBuilder } from './module';
import { DependencyGraph } from './graph';
import { NestBridge } from './nest-bridge';
import { PrismaClient } from '../prisma-client';
import { ConsoleLogger, InMemoryMetrics, DummyTracer, ObservedEventDispatcher, ObservedQueue, ObservedEventOutbox, ObservedRepository } from '../observability';
import { InProcessEventDispatcher, PrismaEventOutbox } from '../events';
import { BullQueueAdapter, OutboxJobDispatcher } from '../queues';
import { InMemoryWorkerRegistry, DefaultLeasePolicy, PrismaLeaseManager, WorkerRuntimeEngine } from '../workers';
import { BullWorkerAdapter } from '../queues/adapters';
import {
  PrismaLearningRepository,
  PrismaWorkflowRepository,
  PrismaStudyPlanRepository,
  PrismaAssessmentRepository,
  PrismaRevisionRepository,
  PrismaAnalyticsRepository,
  PrismaSecurityRepository,
  PrismaIntegrationRepository,
  PrismaRecommendationRepository,
  PrismaAssetRepository
} from '../adapters';
import { AppConfigurationProvider } from '../config';
import { HealthPlatform } from '../health';
import { LocalDiskStorageProvider, ObjectStoragePlatform } from '../storage';
import Redis from 'ioredis';
import { RedisCacheProvider } from '../redis';
import { TokenAccountant } from '@studyai/domain';

export class InfrastructureBootstrap {
  static boot(): any[] {
    const builder = new ModuleBuilder('InfrastructureModule');

    builder
      // Native infrastructure registration of PrismaClient.
      .register('PrismaClient', { factory: () => new PrismaClient() })
      .register('ILogger', { useClass: ConsoleLogger })
      .register('IMetrics', { useClass: InMemoryMetrics })
      .register('ITracer', { useClass: DummyTracer })
      
      .register('RawEventDispatcher', { useClass: InProcessEventDispatcher })
      .register('IEventDispatcher', {
        dependencies: ['RawEventDispatcher', 'ILogger', 'IMetrics', 'ITracer'],
        factory: (raw: InProcessEventDispatcher, logger: ConsoleLogger, metrics: InMemoryMetrics, tracer: DummyTracer) => 
          new ObservedEventDispatcher(raw, logger, metrics, tracer)
      })

      .register('RedisClient', {
        factory: () => new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })
      })
      .register('IDomainCacheService', {
        dependencies: ['RedisClient'],
        factory: (redis: Redis) => new RedisCacheProvider(redis)
      })
      .register('TokenAccountant', {
        dependencies: ['IDomainCacheService'],
        factory: (cache: RedisCacheProvider) => new TokenAccountant(cache)
      })
      
      .register('RawQueue', {
        dependencies: ['RedisClient'],
        factory: (redis: Redis) => new BullQueueAdapter('studyai-main-queue', redis)
      })
      .register('IQueue', {
        dependencies: ['RawQueue', 'ILogger', 'IMetrics', 'ITracer'],
        factory: (raw: BullQueueAdapter, logger: ConsoleLogger, metrics: InMemoryMetrics, tracer: DummyTracer) => 
          new ObservedQueue(raw, 'studyai-main-queue', logger, metrics, tracer)
      })
      .register('IJobDispatcher', {
        dependencies: ['IQueue', 'PrismaClient'],
        factory: (queue: BullQueueAdapter, prisma: PrismaClient) => new OutboxJobDispatcher(queue, prisma)
      })
      
      .register('IWorkerRegistry', { useClass: InMemoryWorkerRegistry })
      .register('ILeasePolicy', { useClass: DefaultLeasePolicy })
      .register('ILeaseManager', {
        dependencies: ['PrismaClient', 'ILeasePolicy'],
        factory: (prisma: PrismaClient, policy: DefaultLeasePolicy) => new PrismaLeaseManager(prisma, policy)
      })
      .register('IWorker', {
        dependencies: ['RedisClient', 'PrismaClient', 'IWorkerRegistry', 'ILeaseManager'],
        factory: (redis: Redis, prisma: PrismaClient, registry: InMemoryWorkerRegistry, leaseManager: PrismaLeaseManager) => 
          new BullWorkerAdapter('studyai-main-queue', 'default-worker-1', 'worker-id-uuid-1', redis, prisma, registry, leaseManager)
      })
      .register('IWorkerRuntimeEngine', {
        dependencies: ['IWorkerRegistry', 'ILeaseManager', 'IWorker', 'PrismaClient'],
        factory: (registry: InMemoryWorkerRegistry, leaseManager: PrismaLeaseManager, worker: BullWorkerAdapter, prisma: PrismaClient) => 
          new WorkerRuntimeEngine('worker-id-uuid-1', 'default-worker-1', registry, leaseManager, worker, prisma)
      })

      .register('RawEventOutbox', {
        dependencies: ['PrismaClient', 'IEventDispatcher', 'IJobDispatcher'],
        factory: (prisma: PrismaClient, dispatcher: ObservedEventDispatcher, jobDispatcher: OutboxJobDispatcher) => {
          const allEventTypes = ['WorkflowCompletedEvent', 'StudyPlanGeneratedEvent', 'AssessmentSubmittedEvent', 'LearningAssetCreatedEvent'];
          for (const type of allEventTypes) {
            dispatcher.subscribe(type, async (event) => {
              await jobDispatcher.dispatch(event);
            });
          }
          return new PrismaEventOutbox(prisma, dispatcher);
        }
      })
      .register('IEventOutbox', {
        dependencies: ['RawEventOutbox', 'ILogger', 'IMetrics', 'ITracer'],
        factory: (raw: PrismaEventOutbox, logger: ConsoleLogger, metrics: InMemoryMetrics, tracer: DummyTracer) => 
          new ObservedEventOutbox(raw, logger, metrics, tracer)
      })

      // Repositories
      .register('ILearningRepository', {
        dependencies: ['PrismaClient', 'IEventOutbox', 'ILogger', 'IMetrics', 'ITracer'],
        factory: (prisma: PrismaClient, outbox: PrismaEventOutbox, logger: ConsoleLogger, metrics: InMemoryMetrics, tracer: DummyTracer) => 
          new ObservedRepository(new PrismaLearningRepository(prisma, outbox), 'LearningRepository', logger, metrics, tracer)
      })
      .register('IWorkflowRepository', {
        dependencies: ['PrismaClient', 'IEventOutbox', 'ILogger', 'IMetrics', 'ITracer'],
        factory: (prisma: PrismaClient, outbox: PrismaEventOutbox, logger: ConsoleLogger, metrics: InMemoryMetrics, tracer: DummyTracer) => 
          new ObservedRepository(new PrismaWorkflowRepository(prisma, outbox), 'WorkflowRepository', logger, metrics, tracer)
      })
      .register('IStudyPlanRepository', {
        dependencies: ['PrismaClient', 'IEventOutbox', 'ILogger', 'IMetrics', 'ITracer'],
        factory: (prisma: PrismaClient, outbox: PrismaEventOutbox, logger: ConsoleLogger, metrics: InMemoryMetrics, tracer: DummyTracer) => 
          new ObservedRepository(new PrismaStudyPlanRepository(prisma, outbox), 'StudyPlanRepository', logger, metrics, tracer)
      })
      .register('IAssessmentRepository', {
        dependencies: ['PrismaClient', 'IEventOutbox', 'ILogger', 'IMetrics', 'ITracer'],
        factory: (prisma: PrismaClient, outbox: PrismaEventOutbox, logger: ConsoleLogger, metrics: InMemoryMetrics, tracer: DummyTracer) => 
          new ObservedRepository(new PrismaAssessmentRepository(prisma, outbox), 'AssessmentRepository', logger, metrics, tracer)
      })
      .register('IRevisionRepository', {
        dependencies: ['PrismaClient', 'IEventOutbox', 'ILogger', 'IMetrics', 'ITracer'],
        factory: (prisma: PrismaClient, outbox: PrismaEventOutbox, logger: ConsoleLogger, metrics: InMemoryMetrics, tracer: DummyTracer) => 
          new ObservedRepository(new PrismaRevisionRepository(prisma, outbox), 'RevisionRepository', logger, metrics, tracer)
      })
      .register('IAnalyticsRepository', {
        dependencies: ['PrismaClient', 'IEventOutbox', 'ILogger', 'IMetrics', 'ITracer'],
        factory: (prisma: PrismaClient, outbox: PrismaEventOutbox, logger: ConsoleLogger, metrics: InMemoryMetrics, tracer: DummyTracer) => 
          new ObservedRepository(new PrismaAnalyticsRepository(prisma, outbox), 'AnalyticsRepository', logger, metrics, tracer)
      })
      .register('ISecurityRepository', {
        dependencies: ['PrismaClient', 'IEventOutbox', 'ILogger', 'IMetrics', 'ITracer'],
        factory: (prisma: PrismaClient, outbox: PrismaEventOutbox, logger: ConsoleLogger, metrics: InMemoryMetrics, tracer: DummyTracer) => 
          new ObservedRepository(new PrismaSecurityRepository(prisma, outbox), 'SecurityRepository', logger, metrics, tracer)
      })
      .register('IIntegrationRepository', {
        dependencies: ['PrismaClient', 'IEventOutbox', 'ILogger', 'IMetrics', 'ITracer'],
        factory: (prisma: PrismaClient, outbox: PrismaEventOutbox, logger: ConsoleLogger, metrics: InMemoryMetrics, tracer: DummyTracer) => 
          new ObservedRepository(new PrismaIntegrationRepository(prisma, outbox), 'IntegrationRepository', logger, metrics, tracer)
      })
      .register('IRecommendationRepository', {
        dependencies: ['PrismaClient', 'IEventOutbox', 'ILogger', 'IMetrics', 'ITracer'],
        factory: (prisma: PrismaClient, outbox: PrismaEventOutbox, logger: ConsoleLogger, metrics: InMemoryMetrics, tracer: DummyTracer) => 
          new ObservedRepository(new PrismaRecommendationRepository(prisma, outbox), 'RecommendationRepository', logger, metrics, tracer)
      })
      .register('IAssetRepository', {
        dependencies: ['PrismaClient', 'IEventOutbox', 'ILogger', 'IMetrics', 'ITracer'],
        factory: (prisma: PrismaClient, outbox: PrismaEventOutbox, logger: ConsoleLogger, metrics: InMemoryMetrics, tracer: DummyTracer) => 
          new ObservedRepository(new PrismaAssetRepository(prisma, outbox), 'AssetRepository', logger, metrics, tracer)
      })
      
      .register('IConfigurationProvider', {
        factory: () => new AppConfigurationProvider()
      })
      .register('IHealthProvider', {
        dependencies: ['PrismaClient', 'IQueue', 'IDomainCacheService'],
        factory: (prisma: PrismaClient, queue: BullQueueAdapter, cache: RedisCacheProvider) => new HealthPlatform(prisma, queue, cache)
      })
      
      .register('IStorageProvider', {
        factory: () => {
          const storagePath = process.env.STORAGE_PATH || './.storage';
          return new LocalDiskStorageProvider(storagePath);
        }
      })
      .register('IObjectStorage', {
        dependencies: ['IStorageProvider', 'PrismaClient'],
        factory: (provider: LocalDiskStorageProvider, prisma: PrismaClient) => new ObjectStoragePlatform(provider, prisma)
      });

    const moduleDesc = builder.build();
    
    // Validate the graph independently of NestJS
    const graph = new DependencyGraph();
    const resolvedProviders = graph.getResolutionOrder([moduleDesc]);

    // Bridge to NestJS
    return NestBridge.generateProviders(resolvedProviders);
  }
}
