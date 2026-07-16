import { IDomainEvent } from '@studyai/domain';
import { IJobDispatcher, IQueue, IJob } from './contracts';
import { PrismaClient } from '../prisma-client';
import crypto from 'crypto';

export class OutboxJobDispatcher implements IJobDispatcher {
  constructor(
    private readonly queue: IQueue,
    private readonly prisma: PrismaClient
  ) {}

  async dispatch(event: IDomainEvent): Promise<void> {
    // 1. Map Domain Event to Job Type
    // In a real system, this could be a dynamic map. For now, simple mapping:
    const jobType = this.mapEventToJobType(event.eventType);
    
    if (!jobType) {
      // Event doesn't trigger a background job
      return;
    }

    const jobId = crypto.randomUUID();

    // 2. Create Persistent Job History (PostgreSQL)
    await this.prisma.jobExecution.create({
      data: {
        jobId,
        jobType,
        correlationId: event.eventId,
        aggregateId: event.aggregateId,
        status: 'PENDING',
        payloadHash: this.hashPayload(event.payload),
      }
    });

    // 3. Construct Queue Job
    const job: IJob = {
      jobId,
      jobType,
      correlationId: event.eventId,
      priority: 0,
      payload: event.payload
    };

    // 4. Enqueue to Execution Engine (BullMQ)
    await this.queue.enqueue(job);
  }

  private mapEventToJobType(eventType: string): string | null {
    const routingTable: Record<string, string> = {
      'WorkflowCompletedEvent': 'ProcessWorkflowCompletionJob',
      'StudyPlanGeneratedEvent': 'NotifyStudyPlanReadyJob',
      'AssessmentSubmittedEvent': 'GradeAssessmentJob',
      'LearningAssetCreatedEvent': 'ExtractTextFromAssetJob'
    };
    return routingTable[eventType] || null;
  }

  private hashPayload(payload: any): string {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}
