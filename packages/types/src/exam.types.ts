export enum QuestionType {
  MCQ = 'mcq',
  TRUE_FALSE = 'true_false',
  FILL_BLANK = 'fill_blank',
  ESSAY = 'essay',
  SHORT = 'short',
}

export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  MIXED = 'mixed',
}

export enum ExamStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export interface StrengthAnalysis {
  topics: string[];
  description: string;
}

export interface WeaknessAnalysis {
  topics: string[];
  description: string;
}

export interface StudyPlan {
  steps: string[];
  recommendations: string[];
}

export interface Exam {
  id: string;
  fileId: string;
  userId: string;
  title: string;
  difficulty: Difficulty;
  totalQuestions: number;
  timeLimitMinutes?: number | null;
  status: ExamStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
  score?: number | null; // e.g. percentage 0-100
  strengthAnalysis?: StrengthAnalysis | null;
  weaknessAnalysis?: WeaknessAnalysis | null;
  studyPlan?: StudyPlan | null;
  createdAt: Date;
}

export interface Question {
  id: string;
  examId: string;
  type: QuestionType;
  questionText: string;
  options?: string[] | null; // For MCQ
  correctAnswer: string;
  userAnswer?: string | null;
  isCorrect?: boolean | null;
  explanation?: string | null;
  difficulty: Difficulty;
  orderIndex: number;
  points: number;
  answeredAt?: Date | null;
}

export interface CreateExamDto {
  fileId: string;
  difficulty: Difficulty;
  totalQuestions: number;
  timeLimitMinutes?: number;
  questionTypes: QuestionType[];
}

export interface SubmitAnswerDto {
  questionId: string;
  userAnswer: string;
}

export interface SubmitExamDto {
  answers: SubmitAnswerDto[];
}
