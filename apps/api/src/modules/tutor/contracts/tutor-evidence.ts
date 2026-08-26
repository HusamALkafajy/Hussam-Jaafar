import { KnowledgeNode, KnowledgeEdge } from '../../knowledge/contracts/knowledge-graph';
import { Flashcard } from '../../flashcards/engine/contracts/flashcard';
import { QuizQuestionAsset } from '../../quizzes/engine/contracts/quiz';
import { LearningAsset } from '../../learning-assets/contracts/learning-asset';

export interface SemanticChunkEvidence {
  chunkId: string;
  content: string;
  page?: number;
  relevanceScore: number;
}

import { KnowledgeEvidence } from '../../knowledge/contracts/knowledge-evidence';

export interface SemanticChunkEvidence {
  chunkId: string;
  content: string;
  page?: number;
  relevanceScore: number;
}

export interface TutorEvidence extends KnowledgeEvidence {
  semanticChunks: SemanticChunkEvidence[];
  citations: string[];
}
