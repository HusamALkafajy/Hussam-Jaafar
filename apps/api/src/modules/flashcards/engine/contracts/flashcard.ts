export type CardType = 
  | 'Definition' 
  | 'Concept' 
  | 'Question -> Answer' 
  | 'Term -> Explanation' 
  | 'Cloze' 
  | 'Example -> Concept';

export interface Flashcard {
  flashcardId: string;
  knowledgeNodeId: string;
  knowledgeNodeVersion: string;
  originGraphVersion: string;
  cardType: CardType;
  front: string;
  back: string;
  difficulty: number;
  confidenceScore: number;
  sourceReferences: string[]; // e.g. chunk IDs or node/edge IDs
  tags: string[];
  createdAt: Date;
  version: string;
}
