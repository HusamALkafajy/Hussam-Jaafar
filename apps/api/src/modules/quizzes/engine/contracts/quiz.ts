export type QuestionType = 'mcq' | 'true_false' | 'fill_blank' | 'short';

export interface QuizQuestionAsset {
  quizQuestionId: string;
  knowledgeNodeId: string;
  knowledgeNodeVersion: string;
  originGraphVersion: string;
  type: QuestionType;
  front: string;
  back: string;
  options?: string[];
  sourceReferences: string[];
  version: string;
}
