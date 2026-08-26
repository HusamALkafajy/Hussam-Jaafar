import { PlanningContext } from './planning-context';
import { SchedulingPolicy } from './policies/scheduling-policy';

export class SessionPlanner {
  constructor(private schedulingPolicy: SchedulingPolicy) {}

  planSession(context: PlanningContext): number {
    return this.schedulingPolicy.estimateDurationSeconds(context);
  }
}
