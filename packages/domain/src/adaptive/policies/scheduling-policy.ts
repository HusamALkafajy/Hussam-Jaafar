import { PlanningContext } from '../planning-context';

export interface SchedulingPolicy {
  estimateDurationSeconds(context: PlanningContext): number;
}

export class DefaultSchedulingPolicy implements SchedulingPolicy {
  estimateDurationSeconds(context: PlanningContext): number {
    // Deterministic mock: 30 minutes base + 1 minute per recommendation
    const baseDuration = 1800;
    const additional = (context.recommendations?.length || 0) * 60;
    return baseDuration + additional;
  }
}
