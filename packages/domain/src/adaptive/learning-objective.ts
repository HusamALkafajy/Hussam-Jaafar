export type GoalPriority = 'Critical' | 'High' | 'Medium' | 'Low' | 'Dynamic';
export type GoalStatus = 'NotStarted' | 'InProgress' | 'Completed' | 'Archived';

export interface LearningTask {
  id: string;
  title: string;
  status: GoalStatus;
  targetAssetId?: string;
}

export interface LearningObjective {
  id: string;
  title: string;
  description: string;
  targetAssets: string[];
  completionCriteria: Record<string, any>;
  status: GoalStatus;
  priority: GoalPriority;
  tasks: LearningTask[];
}

export interface StudyGoal {
  id: string;
  title: string;
  description: string;
  objectives: LearningObjective[];
  status: GoalStatus;
  priority: GoalPriority;
  targetDate?: string;
}
