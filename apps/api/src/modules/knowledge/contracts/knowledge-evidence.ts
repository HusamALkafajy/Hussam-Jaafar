import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from './knowledge-graph';
import { LearningAsset } from '../../learning-assets/contracts/learning-asset';
import { Flashcard } from '../../flashcards/engine/contracts/flashcard';
import { QuizQuestionAsset } from '../../quizzes/engine/contracts/quiz';

/**
 * The canonical evidence model provided to consumers (Tutor, etc.).
 * Unifies the Knowledge Graph, RAG semantic chunks, and related learning assets.
 */
export interface KnowledgeEvidence {
  graph: KnowledgeGraph;
  knowledgeNodes: KnowledgeNode[];
  relationships: KnowledgeEdge[];
  semanticChunks: any[]; // Depending on RAG implementation, usually array of semantic chunk objects
  flashcards: LearningAsset<Flashcard>[];
  quizzes: LearningAsset<QuizQuestionAsset>[];
  citations: any[];
  metadata: {
    originVersion: string;
    documentId?: string;
    confidenceScore: number;
  };
}
