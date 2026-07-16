import { PrismaClient } from '../prisma-client';
import { IAssessmentRepository } from '../repositories/domain-repositories';
import { IEventOutbox } from '../events/outbox';
import { AssessmentSubmittedEvent } from '@studyai/domain';

export class PrismaAssessmentRepository implements IAssessmentRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly outbox: IEventOutbox
  ) {}

  async findById(id: string): Promise<any | null> {
    return this.prisma.assessment.findUnique({
      where: { id },
      include: { questions: true, submissions: true, results: true }
    });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.assessment.findMany({
      include: { questions: true, submissions: true, results: true }
    });
  }

  async save(entity: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.assessment.upsert({
        where: { id: entity.id },
        update: {
          title: entity.title,
          type: entity.type,
          version: { increment: 1 }
        },
        create: {
          id: entity.id,
          title: entity.title,
          type: entity.type,
        }
      });
      
      // Assume entity has some logic to emit events
      await this.outbox.storeEvent(tx, new AssessmentSubmittedEvent(entity.id, 'user', 100));
    });
    await this.outbox.publishPendingEvents();
  }

  async delete(id: string): Promise<void> {
    await this.prisma.assessment.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
