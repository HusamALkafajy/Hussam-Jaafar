import { PrismaClient } from '../prisma-client';
import { IWorkflowRepository } from '../repositories/domain-repositories';
import { IEventOutbox } from '../events/outbox';
import { WorkflowStartedEvent, WorkflowCompletedEvent } from '@studyai/domain';

export class PrismaWorkflowRepository implements IWorkflowRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly outbox: IEventOutbox
  ) {}

  async findById(id: string): Promise<any | null> {
    return this.prisma.workflow.findUnique({
      where: { id },
      include: { jobs: true, events: true }
    });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.workflow.findMany({
      include: { jobs: true, events: true }
    });
  }

  async save(entity: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.workflow.upsert({
        where: { id: entity.id },
        update: {
          status: entity.status,
          payload: entity.payload,
          version: { increment: 1 }
        },
        create: {
          id: entity.id,
          type: entity.type,
          status: entity.status,
          payload: entity.payload
        }
      });

      // Emit event based on status
      if (entity.status === 'PENDING' || entity.status === 'RUNNING') {
        await this.outbox.storeEvent(tx, new WorkflowStartedEvent(entity.id, entity.type));
      } else if (entity.status === 'COMPLETED' || entity.status === 'FAILED') {
        await this.outbox.storeEvent(tx, new WorkflowCompletedEvent(entity.id, entity.status));
      }
    });
    
    // In-process publish hook
    await this.outbox.publishPendingEvents();
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workflow.delete({
      where: { id }
    });
  }
}
