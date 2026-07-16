import { PrismaClient } from '../prisma-client';
import { IIntegrationRepository } from '../repositories/domain-repositories';
import { IEventOutbox } from '../events/outbox';
import { ConnectorConfiguredEvent } from '@studyai/domain';

export class PrismaIntegrationRepository implements IIntegrationRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly outbox: IEventOutbox
  ) {}

  async findById(id: string): Promise<any | null> {
    return this.prisma.connectorInstance.findUnique({
      where: { id },
      include: { events: true, configs: true }
    });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.connectorInstance.findMany({
      include: { events: true, configs: true }
    });
  }

  async save(entity: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.connectorInstance.upsert({
        where: { id: entity.id },
        update: {
          status: entity.status,
        },
        create: {
          id: entity.id,
          provider: entity.provider,
          status: entity.status,
        }
      });
      await this.outbox.storeEvent(tx, new ConnectorConfiguredEvent(entity.id, entity.provider));
    });
    await this.outbox.publishPendingEvents();
  }

  async delete(id: string): Promise<void> {
    await this.prisma.connectorInstance.delete({
      where: { id }
    });
  }
}
