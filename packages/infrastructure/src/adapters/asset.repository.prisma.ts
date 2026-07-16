import { PrismaClient } from '../prisma-client';
import { IAssetRepository } from '../repositories/domain-repositories';
import { IEventOutbox } from '../events/outbox';

export class PrismaAssetRepository implements IAssetRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly outbox: IEventOutbox
  ) {}

  async findById(id: string): Promise<any | null> {
    return this.prisma.platformAsset.findUnique({
      where: { id }
    });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.platformAsset.findMany();
  }

  async save(entity: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.platformAsset.upsert({
        where: { id: entity.id },
        update: {
          size: entity.size,
        },
        create: {
          id: entity.id,
          key: entity.key,
          bucket: entity.bucket,
          size: entity.size,
          mimeType: entity.mimeType,
        }
      });
      // No domain events modeled for raw asset yet
    });
    await this.outbox.publishPendingEvents();
  }

  async delete(id: string): Promise<void> {
    await this.prisma.platformAsset.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
