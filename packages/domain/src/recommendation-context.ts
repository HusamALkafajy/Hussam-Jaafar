export interface UserLearningContext {
  userId: string;
  subjectId?: string;
  recentQuizzes: Array<{
    id: string;
    score: number;
    subjectId: string;
    completedAt: Date;
  }>;
  dueFlashcardsCount: number;
  recentTutorSessions: Array<{
    id: string;
    topic: string;
    createdAt: Date;
  }>;
  lastAccessedResource?: {
    type: 'file' | 'exam' | 'flashcard';
    id: string;
    title: string;
    accessedAt: Date;
  };
}
