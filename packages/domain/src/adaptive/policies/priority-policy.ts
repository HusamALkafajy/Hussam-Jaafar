import { PlanningContext } from '../planning-context';
import { GoalPriority, LearningObjective } from '../learning-objective';

export interface PriorityPolicy {
  calculateObjectivePriority(objective: LearningObjective, context: PlanningContext): GoalPriority;
}

export class DefaultPriorityPolicy implements PriorityPolicy {
  calculateObjectivePriority(objective: LearningObjective, context: PlanningContext): GoalPriority {
    // Deterministic basic logic: if it's already critical, it remains. Otherwise evaluate based on progress.
    // In a real system, this would evaluate context.metrics or upcoming deadlines.
    return objective.priority || 'Medium';
  }
}
