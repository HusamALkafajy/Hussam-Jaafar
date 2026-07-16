import { PlanningContext } from './planning-context';
import { PriorityPolicy } from './policies/priority-policy';
import { LearningObjective, GoalPriority } from './learning-objective';

export class PriorityCalculator {
  constructor(private priorityPolicy: PriorityPolicy) {}

  calculate(objective: LearningObjective, context: PlanningContext): GoalPriority {
    return this.priorityPolicy.calculateObjectivePriority(objective, context);
  }
}
