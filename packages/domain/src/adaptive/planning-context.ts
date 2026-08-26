import { LearningSession } from '../learning-session';
import { LearningMetrics } from '../learning-metrics';
import { ReviewSchedule } from '../review-schedule';
import { Recommendation } from '../recommendation';
import { StudyGoal } from './learning-objective';

export interface PlanningContext {
  readonly sessionId?: string;
  readonly session?: LearningSession;
  readonly metrics?: LearningMetrics;
  readonly schedules?: ReviewSchedule[];
  readonly recommendations?: Recommendation[];
  readonly goals?: StudyGoal[];
}
