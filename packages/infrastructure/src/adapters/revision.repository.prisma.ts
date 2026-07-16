import { PrismaClient } from '../prisma-client';
import { IRevisionRepository } from '../repositories/domain-repositories';
import { IEventOutbox } from '../events/outbox';
import { RevisionSessionFinishedEvent } from '@studyai/domain';

export class PrismaRevisionRepository implements IRevisionRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly outbox: IEventOutbox
  ) {}

  async findById(id: string): Promise<any | null> {
    return this.prisma.revisionSession.findUnique({
      where: { id },
      include: { items: true, schedules: true }
    });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.revisionSession.findMany({
      include: { items: true, schedules: true }
    });
  }

  async save(entity: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.revisionSession.upsert({
        where: { id: entity.id },
        update: {
          endedAt: entity.endedAt,
          version: { increment: 1 }
        },
        create: {
          id: entity.id,
          userId: entity.userId,
          startedAt: entity.startedAt,
        }
      });
      await this.outbox.storeEvent(tx, new RevisionSessionFinishedEvent(entity.id, 5));
    });
    await this.outbox.publishPendingEvents();
  }

  async delete(id: string): Promise<void> {
    await this.prisma.revisionSession.delete({
      where: { id }
    });
  }
}
