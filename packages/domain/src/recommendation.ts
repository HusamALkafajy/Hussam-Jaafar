export type RecommendationType = 
  | 'ContinueLearning' 
  | 'ReviewWeakConcepts' 
  | 'RetryQuiz' 
  | 'ReviewFlashcards' 
  | 'AskTutor' 
  | 'RecentlyInterrupted' 
  | 'ContinueSession';

export interface RecommendationEvidence {
  sourceType: 'quiz_result' | 'flashcard_review' | 'knowledge_graph' | 'tutor_session' | 'study_history';
  sourceId?: string;
  description: string;
}

export interface Recommendation {
  readonly id: string;
  readonly type: RecommendationType;
  readonly priority: 'High' | 'Medium' | 'Low';
  readonly confidence: number; // 0.0 to 1.0
  readonly educationalObjective: string;
  readonly explanation: string;
  readonly evidence: RecommendationEvidence[];
  readonly targetResourceId?: string;
  readonly targetResourceType?: string;
}
