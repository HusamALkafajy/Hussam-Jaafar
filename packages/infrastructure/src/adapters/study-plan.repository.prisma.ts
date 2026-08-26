import { PrismaClient } from '../prisma-client';
import { IStudyPlanRepository } from '../repositories/domain-repositories';
import { IEventOutbox } from '../events/outbox';
import { StudyPlanGeneratedEvent } from '@studyai/domain';

export class PrismaStudyPlanRepository implements IStudyPlanRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly outbox: IEventOutbox
  ) {}

  async findById(id: string): Promise<any | null> {
    return this.prisma.studyPlan.findUnique({
      where: { id },
      include: { objectives: true }
    });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.studyPlan.findMany({
      include: { objectives: true }
    });
  }

  async save(entity: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.studyPlan.upsert({
        where: { id: entity.id },
        update: {
          title: entity.title,
          goal: entity.goal,
          version: { increment: 1 }
        },
        create: {
          id: entity.id,
          userId: entity.userId,
          title: entity.title,
          goal: entity.goal,
        }
      });
      
      // Store event in outbox atomically
      await this.outbox.storeEvent(tx, new StudyPlanGeneratedEvent(entity.id, entity.goal));
    });

    await this.outbox.publishPendingEvents();
  }

  async delete(id: string): Promise<void> {
    await this.prisma.studyPlan.delete({ where: { id } });
  }
}
