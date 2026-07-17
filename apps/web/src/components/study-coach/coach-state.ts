import { StudyPlan } from '@studyai/domain/adaptive/study-plan';
import { PlanningContext } from '@studyai/domain/adaptive/planning-context';
import { TimelineEvent } from '@studyai/domain/adaptive/learning-timeline';
import { InsightModel } from './insight-builder';

// Purely Presentation State
export interface CoachPresentationState {
  activeTab: 'overview' | 'plan' | 'recommendations' | 'progress' | 'history';
  conversationExpanded: boolean;
  filters: Record<string, any>;
}

// Coach View State (Selections)
export interface CoachViewState {
  selectedRecommendationId?: string;
  selectedGoalId?: string;
  selectedTimelineEventId?: string;
}

// Domain Projection (Immutable)
export interface CoachDomainState {
  plan?: StudyPlan;
  context?: PlanningContext;
  timeline: readonly TimelineEvent[];
  insights: InsightModel[];
}
