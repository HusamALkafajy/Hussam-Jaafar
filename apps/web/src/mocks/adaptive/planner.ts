import { SessionPlanner } from '@studyai/domain/adaptive/session-planner';
import { DefaultSchedulingPolicy } from '@studyai/domain/adaptive/policies/scheduling-policy';

export const MOCK_SESSION_PLANNER = new SessionPlanner(new DefaultSchedulingPolicy());
