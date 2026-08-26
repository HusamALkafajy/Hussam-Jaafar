import { PrismaClient } from '../prisma-client';
import { ILearningRepository } from '../repositories/domain-repositories';
import { IEventOutbox } from '../events/outbox';
import { LearningAssetCreatedEvent } from '@studyai/domain';

export class PrismaLearningRepository implements ILearningRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly outbox: IEventOutbox
  ) {}

  async findById(id: string): Promise<any | null> {
    return this.prisma.learningAsset.findUnique({
      where: { id },
      include: { capabilities: true }
    });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.learningAsset.findMany({
      include: { capabilities: true }
    });
  }

  async save(entity: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.learningAsset.upsert({
        where: { id: entity.id },
        update: {
          title: entity.title,
          status: entity.status,
          content: entity.content
        },
        create: {
          id: entity.id,
          userId: entity.userId,
          title: entity.title,
          type: entity.type,
          status: entity.status,
          content: entity.content
        }
      });

      // Simple mock logic: If status is READY, it's newly created/processed
      if (entity.status === 'READY') {
        await this.outbox.storeEvent(tx, new LearningAssetCreatedEvent(entity.id, entity.type, entity.title));
      }
    });
    
    await this.outbox.publishPendingEvents();
  }

  async delete(id: string): Promise<void> {
    await this.prisma.learningAsset.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
