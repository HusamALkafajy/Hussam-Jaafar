import { DomainEvent } from './domain-event.interface';

// -----------------------------------------------------------------------------
// WORKFLOW EVENTS
// -----------------------------------------------------------------------------
export class WorkflowStartedEvent extends DomainEvent<{ workflowType: string }> {
  constructor(aggregateId: string, workflowType: string) {
    super({
      aggregateId,
      aggregateType: 'Workflow',
      eventType: 'WorkflowStartedEvent',
      payload: { workflowType }
    });
  }
}

export class WorkflowCompletedEvent extends DomainEvent<{ status: string }> {
  constructor(aggregateId: string, status: string) {
    super({
      aggregateId,
      aggregateType: 'Workflow',
      eventType: 'WorkflowCompletedEvent',
      payload: { status }
    });
  }
}

// -----------------------------------------------------------------------------
// LEARNING EVENTS
// -----------------------------------------------------------------------------
export class LearningAssetCreatedEvent extends DomainEvent<{ assetType: string; title: string }> {
  constructor(aggregateId: string, assetType: string, title: string) {
    super({
      aggregateId,
      aggregateType: 'LearningAsset',
      eventType: 'LearningAssetCreatedEvent',
      payload: { assetType, title }
    });
  }
}

// -----------------------------------------------------------------------------
// STUDY PLAN EVENTS
// -----------------------------------------------------------------------------
export class StudyPlanGeneratedEvent extends DomainEvent<{ goal: string }> {
  constructor(aggregateId: string, goal: string) {
    super({
      aggregateId,
      aggregateType: 'StudyPlan',
      eventType: 'StudyPlanGeneratedEvent',
      payload: { goal }
    });
  }
}

// -----------------------------------------------------------------------------
// ASSESSMENT EVENTS
// -----------------------------------------------------------------------------
export class AssessmentSubmittedEvent extends DomainEvent<{ userId: string; score: number }> {
  constructor(aggregateId: string, userId: string, score: number) {
    super({
      aggregateId,
      aggregateType: 'Assessment',
      eventType: 'AssessmentSubmittedEvent',
      payload: { userId, score }
    });
  }
}

// -----------------------------------------------------------------------------
// REVISION EVENTS
// -----------------------------------------------------------------------------
export class RevisionSessionFinishedEvent extends DomainEvent<{ itemsReviewed: number }> {
  constructor(aggregateId: string, itemsReviewed: number) {
    super({
      aggregateId,
      aggregateType: 'RevisionSession',
      eventType: 'RevisionSessionFinishedEvent',
      payload: { itemsReviewed }
    });
  }
}

// -----------------------------------------------------------------------------
// SECURITY EVENTS
// -----------------------------------------------------------------------------
export class SecurityDecisionLoggedEvent extends DomainEvent<{ action: string; resource: string; granted: boolean }> {
  constructor(aggregateId: string, action: string, resource: string, granted: boolean) {
    super({
      aggregateId,
      aggregateType: 'IdentityContext',
      eventType: 'SecurityDecisionLoggedEvent',
      payload: { action, resource, granted }
    });
  }
}

// -----------------------------------------------------------------------------
// INTEGRATION EVENTS
// -----------------------------------------------------------------------------
export class ConnectorConfiguredEvent extends DomainEvent<{ provider: string }> {
  constructor(aggregateId: string, provider: string) {
    super({
      aggregateId,
      aggregateType: 'ConnectorInstance',
      eventType: 'ConnectorConfiguredEvent',
      payload: { provider }
    });
  }
}

// -----------------------------------------------------------------------------
// ANALYTICS EVENTS
// -----------------------------------------------------------------------------
export class AnalyticsSnapshotCreatedEvent extends DomainEvent<{ metricsCount: number }> {
  constructor(aggregateId: string, metricsCount: number) {
    super({
      aggregateId,
      aggregateType: 'AnalyticsSnapshot',
      eventType: 'AnalyticsSnapshotCreatedEvent',
      payload: { metricsCount }
    });
  }
}

// -----------------------------------------------------------------------------
// RECOMMENDATION EVENTS
// -----------------------------------------------------------------------------
export class RecommendationAcceptedEvent extends DomainEvent<{ targetId: string }> {
  constructor(aggregateId: string, targetId: string) {
    super({
      aggregateId,
      aggregateType: 'RecommendationContext',
      eventType: 'RecommendationAcceptedEvent',
      payload: { targetId }
    });
  }
}
