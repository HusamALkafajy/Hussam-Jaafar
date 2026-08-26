import { PlanningContext } from './planning-context';
import { CompletionPolicy } from './policies/completion-policy';
import { LearningObjective } from './learning-objective';

export class CompletionEvaluator {
  constructor(private completionPolicy: CompletionPolicy) {}

  evaluate(objective: LearningObjective, context: PlanningContext): boolean {
    return this.completionPolicy.isObjectiveComplete(objective, context);
  }
}
