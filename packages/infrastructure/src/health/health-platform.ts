import { IHealthProvider, HealthStatus } from './health.provider';
import { PrismaClient } from '../prisma-client';
import { IQueue } from '../queues/contracts';
import { IDomainCacheService } from '@studyai/domain';

export class HealthPlatform implements IHealthProvider {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly queue: IQueue,
    private readonly cache: IDomainCacheService
  ) {}

  async checkDatabase(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { service: 'Database', status: 'UP', latencyMs: Date.now() - start };
    } catch (e) {
      return { service: 'Database', status: 'DOWN', latencyMs: Date.now() - start };
    }
  }

  async checkQueue(): Promise<HealthStatus> {
    // In a real implementation, we'd ping Redis/BullMQ. For now, assume it's up if it doesn't throw on some status check.
    const start = Date.now();
    try {
      // Mock check
      return { service: 'Queue', status: 'UP', latencyMs: Date.now() - start };
    } catch (e) {
      return { service: 'Queue', status: 'DOWN', latencyMs: Date.now() - start };
    }
  }

  async checkWorkerRuntime(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      const activeWorkers = await this.prisma.workerRuntime.count({
        where: { leaseExpiration: { gt: new Date() } }
      });
      return { service: 'WorkerRuntime', status: activeWorkers > 0 ? 'UP' : 'DOWN', latencyMs: Date.now() - start };
    } catch (e) {
      return { service: 'WorkerRuntime', status: 'DOWN', latencyMs: Date.now() - start };
    }
  }

  async checkOutbox(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      const pendingEvents = await this.prisma.storedEvent.count({
        where: { status: 'PENDING' }
      });
      return { service: 'EventOutbox', status: 'UP', latencyMs: Date.now() - start };
    } catch (e) {
      return { service: 'EventOutbox', status: 'DOWN', latencyMs: Date.now() - start };
    }
  }

  async checkEventDispatcher(): Promise<HealthStatus> {
    const start = Date.now();
    return { service: 'EventDispatcher', status: 'UP', latencyMs: Date.now() - start };
  }

  async checkCache(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      await this.cache.ping();
      return { service: 'Cache', status: 'UP', latencyMs: Date.now() - start };
    } catch (e) {
      return { service: 'Cache', status: 'DOWN', latencyMs: Date.now() - start };
    }
  }
}
