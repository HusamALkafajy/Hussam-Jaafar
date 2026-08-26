export type Statistics = {
  totalStudyTimeHours: number;
  documentsRead: number;
  flashcardsReviewed: number;
  quizzesCompleted: number;
  averageScore: number;
  currentStreakDays: number;
  longestStreakDays: number;
};

export const MOCK_STATISTICS: Statistics = {
  totalStudyTimeHours: 142.5,
  documentsRead: 38,
  flashcardsReviewed: 1250,
  quizzesCompleted: 14,
  averageScore: 88.5,
  currentStreakDays: 12,
  longestStreakDays: 24,
};
