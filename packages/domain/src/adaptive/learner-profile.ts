export interface ConceptMastery {
  conceptId: string;
  masteryScore: number; // 0 to 1
  confidence: number;   // 0 to 1
  lastEvaluatedAt: string; // ISO date
}

export interface ActivitySummary {
  lastStudySession: string; // ISO date
  totalSessionsThisWeek: number;
  averageSessionDurationMinutes: number;
  learningStreakDays: number;
}

export interface LearnerProfile {
  userId: string;
  currentLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  preferredPace: 'Slow' | 'Standard' | 'Fast';
  strongConcepts: ConceptMastery[];
  weakConcepts: ConceptMastery[];
  recentActivity: ActivitySummary;
  consistencyScore: number; // 0 to 1
  updatedAt: string; // ISO date
}
