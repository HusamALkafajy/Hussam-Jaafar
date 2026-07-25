import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from '../../knowledge/contracts/knowledge-graph';
import { Flashcard, CardType } from './contracts/flashcard';
import * as crypto from 'crypto';

export class FlashcardEngine {
  /**
   * Generates a deterministic set of Flashcards from the Canonical Knowledge Graph.
   */
  public generateCards(graph: KnowledgeGraph): Flashcard[] {
    const cards: Flashcard[] = [];
    
    if (!graph || !graph.nodes || !graph.edges) {
      return cards; // Empty graph returns empty array
    }

    const nodeMap = new Map<string, KnowledgeNode>();
    for (const node of graph.nodes) {
      nodeMap.set(node.id, node);
    }

    // 1. Generate node-based cards (e.g., Concept, Term)
    for (const node of graph.nodes) {
      if (node.type === 'Concept' && node.content && node.content.trim().length > 5) {
        // Only generate isolated Concept card if it's descriptive enough
        const card = this.createDraftCard(graph, node, 'Concept', node.label, node.content);
        if (this.isValidCard(card)) cards.push(card);
      }
      
      if (node.type === 'Term' && node.content && node.content.trim().length > 5) {
        const card = this.createDraftCard(graph, node, 'Term -> Explanation', node.label, node.content);
        if (this.isValidCard(card)) cards.push(card);
      }
    }

    // 2. Generate edge-based cards (e.g., Definition, Cloze, Example)
    for (const edge of graph.edges) {
      const source = nodeMap.get(edge.sourceNodeId);
      const target = nodeMap.get(edge.targetNodeId);

      if (!source || !target) continue;

      if (edge.type === 'DEFINES' && source.type === 'Definition' && target.type === 'Concept') {
        // Definition Card: Front = Target (Concept Label), Back = Source (Definition Content)
        const defCard = this.createDraftCard(graph, source, 'Definition', target.label, source.content);
        if (this.isValidCard(defCard)) cards.push(defCard);

        // Cloze Card: if the concept label appears verbatim in the definition
        if (this.canGenerateCloze(target.label, source.content)) {
          const clozeFront = this.generateClozeFront(target.label, source.content);
          const clozeCard = this.createDraftCard(graph, source, 'Cloze', clozeFront, target.label);
          if (this.isValidCard(clozeCard)) cards.push(clozeCard);
        }
      }

      if (edge.type === 'EXEMPLIFIES' && source.type === 'Example' && target.type === 'Concept') {
        const exCard = this.createDraftCard(graph, source, 'Example -> Concept', `Example of ${target.label}`, source.content);
        if (this.isValidCard(exCard)) cards.push(exCard);
      }
    }

    return this.deduplicateCards(cards);
  }

  /**
   * Constructs the deterministic base structure for a Flashcard.
   */
  private createDraftCard(
    graph: KnowledgeGraph,
    primaryNode: KnowledgeNode,
    cardType: CardType,
    front: string,
    back: string
  ): Flashcard {
    const cleanFront = front.trim();
    const cleanBack = back.trim();

    // Deterministic UUID for the card based on contents + origin version
    const hashPayload = `${graph.metadata.documentId}:${cardType}:${cleanFront}:${cleanBack}:${primaryNode.id}`;
    const flashcardId = crypto.createHash('sha256').update(hashPayload).digest('hex');
    const version = crypto.createHash('sha256').update(hashPayload + `:${graph.metadata.version}`).digest('hex');

    return {
      flashcardId,
      knowledgeNodeId: primaryNode.id,
      knowledgeNodeVersion: primaryNode.version,
      originGraphVersion: graph.metadata.version,
      cardType,
      front: cleanFront,
      back: cleanBack,
      difficulty: 1.0, // Default baseline difficulty
      confidenceScore: primaryNode.confidenceScore,
      sourceReferences: [primaryNode.sourceChunkId],
      tags: [primaryNode.type],
      createdAt: new Date(),
      version
    };
  }

  /**
   * Quality Validation rules for Flashcards.
   */
  private isValidCard(card: Flashcard): boolean {
    // Empty rule
    if (!card.front || !card.back) return false;
    
    // Minimum information threshold (heuristic)
    if (card.front.length < 2 || card.back.length < 2) return false;

    // Missing reference rule
    if (!card.knowledgeNodeId || card.sourceReferences.length === 0) return false;

    // Ambiguous rule (front and back are identical)
    if (card.front.toLowerCase() === card.back.toLowerCase()) return false;

    return true;
  }

  /**
   * Filters out exact duplicates by flashcardId (which factors in Front, Back, Type, and Node).
   */
  private deduplicateCards(cards: Flashcard[]): Flashcard[] {
    const unique = new Map<string, Flashcard>();
    for (const card of cards) {
      if (!unique.has(card.flashcardId)) {
        unique.set(card.flashcardId, card);
      }
    }
    return Array.from(unique.values());
  }

  private canGenerateCloze(concept: string, definition: string): boolean {
    if (!concept || !definition) return false;
    const regex = new RegExp(`\\b${this.escapeRegExp(concept)}\\b`, 'i');
    return regex.test(definition);
  }

  private generateClozeFront(concept: string, definition: string): string {
    const regex = new RegExp(`\\b${this.escapeRegExp(concept)}\\b`, 'gi');
    return definition.replace(regex, '[...]');
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
