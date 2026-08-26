import { PrismaClient } from '../prisma-client';
import { ISecurityRepository } from '../repositories/domain-repositories';
import { IEventOutbox } from '../events/outbox';
import { SecurityDecisionLoggedEvent } from '@studyai/domain';

export class PrismaSecurityRepository implements ISecurityRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly outbox: IEventOutbox
  ) {}

  async findById(id: string): Promise<any | null> {
    return this.prisma.identityContext.findUnique({
      where: { id },
      include: { roles: true, permissions: true }
    });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.identityContext.findMany({
      include: { roles: true, permissions: true }
    });
  }

  async save(entity: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.identityContext.upsert({
        where: { id: entity.id },
        update: {
          metadata: entity.metadata,
        },
        create: {
          id: entity.id,
          userId: entity.userId,
          metadata: entity.metadata,
        }
      });
      await this.outbox.storeEvent(tx, new SecurityDecisionLoggedEvent(entity.id, 'save', 'policy', true));
    });
    await this.outbox.publishPendingEvents();
  }

  async delete(id: string): Promise<void> {
    await this.prisma.identityContext.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
