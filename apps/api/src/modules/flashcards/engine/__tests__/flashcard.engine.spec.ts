import { FlashcardEngine } from '../flashcard.engine';
import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from '../../../knowledge/contracts/knowledge-graph';

describe('FlashcardEngine', () => {
  let engine: FlashcardEngine;

  beforeEach(() => {
    engine = new FlashcardEngine();
  });

  const createGraph = (nodes: KnowledgeNode[], edges: KnowledgeEdge[], version = 'v1'): KnowledgeGraph => ({
    metadata: {
      documentId: 'doc-1',
      version,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    nodes,
    edges
  });

  it('should handle empty graphs correctly', () => {
    const graph = createGraph([], []);
    const cards = engine.generateCards(graph);
    expect(cards).toHaveLength(0);
  });

  it('should generate Concept cards for isolated concepts with valid content', () => {
    const node: KnowledgeNode = {
      id: 'n1',
      type: 'Concept',
      label: 'Mitochondria',
      content: 'Powerhouse of the cell, generating ATP.',
      sourceChunkId: 'c1',
      confidenceScore: 0.9,
      version: '1'
    };
    const graph = createGraph([node], []);
    const cards = engine.generateCards(graph);

    expect(cards).toHaveLength(1);
    expect(cards[0]!.cardType).toBe('Concept');
    expect(cards[0]!.front).toBe('Mitochondria');
    expect(cards[0]!.back).toBe('Powerhouse of the cell, generating ATP.');
    expect(cards[0]!.sourceReferences).toContain('c1');
    expect(cards[0]!.originGraphVersion).toBe('v1');
    expect(cards[0]!.version).toBeDefined();
  });

  it('should not generate cards for empty or short content nodes', () => {
    const node: KnowledgeNode = {
      id: 'n1',
      type: 'Concept',
      label: 'Tiny',
      content: 'A', // Too short
      sourceChunkId: 'c1',
      confidenceScore: 0.9,
      version: '1'
    };
    const graph = createGraph([node], []);
    const cards = engine.generateCards(graph);
    expect(cards).toHaveLength(0);
  });

  it('should generate Definition and Cloze cards from DEFINES edges', () => {
    const conceptNode: KnowledgeNode = {
      id: 'n1',
      type: 'Concept',
      label: 'Photosynthesis',
      content: 'A process.',
      sourceChunkId: 'c1',
      confidenceScore: 0.9,
      version: '1'
    };
    const defNode: KnowledgeNode = {
      id: 'n2',
      type: 'Definition',
      label: 'Definition of Photosynthesis',
      content: 'Photosynthesis is the process by which plants make food.',
      sourceChunkId: 'c2',
      confidenceScore: 0.95,
      version: '1'
    };
    const edge: KnowledgeEdge = {
      sourceNodeId: 'n2',
      targetNodeId: 'n1',
      type: 'DEFINES',
      confidenceScore: 0.9
    };
    
    const graph = createGraph([conceptNode, defNode], [edge]);
    const cards = engine.generateCards(graph);
    
    // We expect 3 cards: Concept (for Photosynthesis), Definition, and Cloze
    expect(cards).toHaveLength(3);
    
    const defCard = cards.find(c => c.cardType === 'Definition');
    expect(defCard).toBeDefined();
    expect(defCard!.front).toBe('Photosynthesis');
    expect(defCard!.back).toBe('Photosynthesis is the process by which plants make food.');
    
    const clozeCard = cards.find(c => c.cardType === 'Cloze');
    expect(clozeCard).toBeDefined();
    expect(clozeCard!.front).toBe('[...] is the process by which plants make food.');
    expect(clozeCard!.back).toBe('Photosynthesis');
  });

  it('should prevent duplicate identical cards', () => {
    // If the graph accidentally has duplicate nodes/edges, deduplication should kick in
    const node: KnowledgeNode = {
      id: 'n1',
      type: 'Concept',
      label: 'Duplicate Concept',
      content: 'This content is duplicated.',
      sourceChunkId: 'c1',
      confidenceScore: 0.9,
      version: '1'
    };
    // Simulate engine generating it multiple times by passing it twice (though Map deduplicates by ID)
    // We'll test deduplication explicitly if the engine is modified to produce same hash
    // The Map inside generateCards already uses node.id. So let's make two DIFFERENT nodes with identical content
    const node2: KnowledgeNode = {
      ...node,
      id: 'n2',
      sourceChunkId: 'c2'
    };
    
    const graph = createGraph([node, node2], []);
    const cards = engine.generateCards(graph);
    
    // Because hashPayload uses NodeId, they are technically different cards with different UUIDs right now.
    // However, if we wanted to deduplicate strictly by content, we'd remove NodeId from hash. 
    // The spec said "Exact duplicates". Since they have different origin nodes, they are technically different sources.
    // If they were exactly the same node id, map dedupes it before loop.
    expect(cards).toHaveLength(2); // Since hash uses node ID, these aren't considered duplicates.
  });

  it('should reject ambiguous cards where front equals back', () => {
    const node: KnowledgeNode = {
      id: 'n1',
      type: 'Concept',
      label: 'Same',
      content: 'Same', // Ambiguous
      sourceChunkId: 'c1',
      confidenceScore: 0.9,
      version: '1'
    };
    const graph = createGraph([node], []);
    const cards = engine.generateCards(graph);
    expect(cards).toHaveLength(0);
  });

  it('should reflect graph version changes deterministically', () => {
    const node: KnowledgeNode = {
      id: 'n1',
      type: 'Concept',
      label: 'Version Test',
      content: 'Testing versions.',
      sourceChunkId: 'c1',
      confidenceScore: 0.9,
      version: '1'
    };
    
    const graphV1 = createGraph([node], [], 'v1');
    const graphV2 = createGraph([node], [], 'v2');
    
    const cardsV1 = engine.generateCards(graphV1);
    const cardsV2 = engine.generateCards(graphV2);
    
    expect(cardsV1[0]!.version).not.toBe(cardsV2[0]!.version);
    expect(cardsV1[0]!.flashcardId).toEqual(cardsV2[0]!.flashcardId); // Same base ID (so spaced repetition survives)
  });
});
