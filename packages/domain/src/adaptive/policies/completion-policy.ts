import { PlanningContext } from '../planning-context';
import { LearningObjective } from '../learning-objective';

export interface CompletionPolicy {
  isObjectiveComplete(objective: LearningObjective, context: PlanningContext): boolean;
}

export class DefaultCompletionPolicy implements CompletionPolicy {
  isObjectiveComplete(objective: LearningObjective, context: PlanningContext): boolean {
    if (objective.status === 'Completed') return true;
    
    // Check if all tasks inside objective are completed
    if (objective.tasks.length > 0) {
      return objective.tasks.every(t => t.status === 'Completed');
    }
    
    return false;
  }
}
