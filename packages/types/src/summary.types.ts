export enum SummaryLevel {
  SHORT = 'short',
  MEDIUM = 'medium',
  COMPREHENSIVE = 'comprehensive',
}

export enum ExplanationLevel {
  SIMPLE = 'simple',
  INTERMEDIATE = 'intermediate',
  ACADEMIC = 'academic',
}

export interface Summary {
  id: string;
  fileId: string;
  userId: string;
  level: SummaryLevel;
  content: string;
  keyPoints?: string[] | null;
  definitions?: Array<{ term: string; definition: string }> | null;
  lawsFormulas?: Array<{ name: string; formula: string; explanation?: string }> | null;
  language: string;
  createdAt: Date;
}

export interface Explanation {
  id: string;
  fileId: string;
  userId: string;
  level: ExplanationLevel;
  content: string;
  examples?: string[] | null;
  comprehensionQuestions?: Array<{ question: string; answer: string }> | null;
  language: string;
  createdAt: Date;
}

export interface CreateSummaryDto {
  fileId: string;
  level: SummaryLevel;
  language?: string;
}

export interface CreateExplanationDto {
  fileId: string;
  level: ExplanationLevel;
  language?: string;
}
