import { PrismaClient } from '../prisma-client';
import { IRecommendationRepository } from '../repositories/domain-repositories';
import { IEventOutbox } from '../events/outbox';
import { RecommendationAcceptedEvent } from '@studyai/domain';

export class PrismaRecommendationRepository implements IRecommendationRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly outbox: IEventOutbox
  ) {}

  async findById(id: string): Promise<any | null> {
    return this.prisma.recommendationContext.findUnique({
      where: { id },
      include: { items: true }
    });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.recommendationContext.findMany({
      include: { items: true }
    });
  }

  async save(entity: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.recommendationContext.upsert({
        where: { id: entity.id },
        update: {
          scope: entity.scope,
        },
        create: {
          id: entity.id,
          userId: entity.userId,
          scope: entity.scope,
        }
      });
      if (entity.status === 'ACCEPTED') {
        // Mock event using targetId fallback for types
        await this.outbox.storeEvent(tx, new RecommendationAcceptedEvent(entity.id, entity.targetId || 'target'));
      }
    });
    await this.outbox.publishPendingEvents();
  }

  async delete(id: string): Promise<void> {
    await this.prisma.recommendationContext.delete({
      where: { id }
    });
  }
}
