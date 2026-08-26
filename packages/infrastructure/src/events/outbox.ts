import { PrismaClient } from '../prisma-client';
import { IDomainEvent } from '@studyai/domain';
import { IEventDispatcher } from './dispatcher';

export interface IEventOutbox {
  storeEvent(prismaTx: any, event: IDomainEvent): Promise<void>;
  publishPendingEvents(): Promise<void>;
}

export class PrismaEventOutbox implements IEventOutbox {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly dispatcher: IEventDispatcher
  ) {}

  /**
   * MUST be called within an existing Prisma transaction `$transaction`
   */
  async storeEvent(prismaTx: any, event: IDomainEvent): Promise<void> {
    await prismaTx.storedEvent.create({
      data: {
        eventId: event.eventId,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventType: event.eventType,
        payload: event.payload as any,
        metadata: event.metadata as any,
        version: event.version,
        occurredAt: event.timestamp,
        status: 'PENDING',
      }
    });
  }

  /**
   * Retrieves pending events, dispatches them in-process, and updates status.
   */
  async publishPendingEvents(): Promise<void> {
    const pendingEvents = await this.prisma.storedEvent.findMany({
      where: { status: 'PENDING' },
      orderBy: { occurredAt: 'asc' },
      take: 100
    });

    for (const record of pendingEvents) {
      try {
        const domainEvent: IDomainEvent = {
          eventId: record.eventId,
          aggregateId: record.aggregateId,
          aggregateType: record.aggregateType,
          eventType: record.eventType,
          timestamp: record.occurredAt,
          version: record.version,
          payload: record.payload,
          metadata: record.metadata ? (record.metadata as Record<string, any>) : undefined
        };

        // Dispatch in-process
        await this.dispatcher.dispatch(domainEvent);

        // Mark as published
        await this.prisma.storedEvent.update({
          where: { eventId: record.eventId },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date()
          }
        });
      } catch (error) {
        // Mark as failed and increment retry
        await this.prisma.storedEvent.update({
          where: { eventId: record.eventId },
          data: {
            status: 'FAILED',
            retryCount: { increment: 1 }
          }
        });
      }
    }
  }
}
