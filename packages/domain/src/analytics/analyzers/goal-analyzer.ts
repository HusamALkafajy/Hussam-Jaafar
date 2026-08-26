import { AnalyticsProjection } from '../store/analytics-projection';

export class GoalAnalyzer {
  static analyze(projection: AnalyticsProjection) {
    const goals = projection.getRawEvents().filter(e => e.type === 'goal.completed');
    
    return {
      completedCount: goals.length
    };
  }
}
