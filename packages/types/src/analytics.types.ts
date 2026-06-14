export enum ActivityAction {
  LOGIN = 'login',
  LOGOUT = 'logout',
  UPLOAD = 'upload',
  EXAM = 'exam',
  SUMMARY = 'summary',
  EXPLANATION = 'explanation',
  CHAT = 'chat',
  FLASHCARD = 'flashcard',
  PAYMENT = 'payment',
  SETTINGS = 'settings',
}

export interface Analytics {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  filesUploaded: number;
  examsTaken: number;
  questionsAnswered: number;
  correctAnswers: number;
  flashcardsReviewed: number;
  studyMinutes: number;
  avgScore: number;
  createdAt: Date;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: ActivityAction;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

export interface OverviewStats {
  filesUploaded: number;
  examsTaken: number;
  studyHours: number;
  completionRate: number; // percentage
  weeklyComparison: {
    filesUploaded: number; // e.g. +10%
    examsTaken: number;
    studyHours: number;
    completionRate: number;
  };
}

export interface WeeklyReport {
  days: string[]; // ['Sun', 'Mon', ...]
  studyMinutes: number[];
  questionsAnswered: number[];
  correctAnswers: number[];
}

export interface MonthlyReport {
  weeks: string[]; // ['Week 1', 'Week 2', ...]
  studyMinutes: number[];
  filesUploaded: number[];
  avgScore: number[];
}
