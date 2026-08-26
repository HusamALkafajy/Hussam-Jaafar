import { PrismaClient } from '../prisma-client';
import { IAnalyticsRepository } from '../repositories/domain-repositories';
import { IEventOutbox } from '../events/outbox';
import { AnalyticsSnapshotCreatedEvent } from '@studyai/domain';

export class PrismaAnalyticsRepository implements IAnalyticsRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly outbox: IEventOutbox
  ) {}

  async findById(id: string): Promise<any | null> {
    return this.prisma.analyticsEvent.findUnique({
      where: { id }
    });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.analyticsEvent.findMany();
  }

  async save(entity: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.analyticsEvent.upsert({
        where: { id: entity.id },
        update: {
          payload: entity.payload,
        },
        create: {
          id: entity.id,
          type: entity.type,
          userId: entity.userId,
          payload: entity.payload,
          timestamp: entity.timestamp || new Date(),
        }
      });
      await this.outbox.storeEvent(tx, new AnalyticsSnapshotCreatedEvent(entity.id, 1));
    });
    await this.outbox.publishPendingEvents();
  }

  async delete(id: string): Promise<void> {
    await this.prisma.analyticsEvent.delete({
      where: { id }
    });
  }
}
