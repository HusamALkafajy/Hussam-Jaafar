export type AssetType = 'Flashcard' | 'QuizQuestion' | 'Summary' | 'StudyNote';

export interface LearningAsset<TPayload = any> {
  assetId: string;
  assetType: AssetType;
  originGraphVersion: string;
  sourceNodeIds: string[];
  sourceEdgeIds: string[];
  difficulty: number;
  confidenceScore: number;
  language: string;
  tags: string[];
  version: string;
  createdAt: Date;
  qualityScore?: number;
  payload: TPayload;
}
