import { QuizEngine } from '../quiz.engine';
import { KnowledgeGraph } from '../../../knowledge/contracts/knowledge-graph';
import { KnowledgeEvidence } from '../../../knowledge/contracts/knowledge-evidence';

describe('QuizEngine', () => {
  let engine: QuizEngine;

  beforeEach(() => {
    engine = new QuizEngine();
  });

  const mockGraph: KnowledgeGraph = {
    metadata: {
      documentId: 'doc-1',
      version: 'v1',
      extractedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    nodes: [
      {
        id: 'node-1',
        type: 'Concept',
        label: 'Photosynthesis',
        content: 'Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of sugar.',
        confidenceScore: 0.9,
        sourceChunkId: 'chunk-1',
        version: 'nv1',
        metadata: {}
      },
      {
        id: 'node-2',
        type: 'Definition',
        label: 'Definition of Photosynthesis',
        content: 'The process by which plants make their own food using sunlight.',
        confidenceScore: 0.9,
        sourceChunkId: 'chunk-1',
        version: 'nv1',
        metadata: {}
      },
      {
        id: 'node-3',
        type: 'Concept',
        label: 'Respiration',
        content: 'Respiration is the process where living organisms produce energy.',
        confidenceScore: 0.9,
        sourceChunkId: 'chunk-2',
        version: 'nv1',
        metadata: {}
      },
      {
        id: 'node-4',
        type: 'Concept',
        label: 'Osmosis',
        content: 'Osmosis is the spontaneous net movement of solvent molecules through a selectively permeable membrane.',
        confidenceScore: 0.9,
        sourceChunkId: 'chunk-3',
        version: 'nv1',
        metadata: {}
      },
      {
        id: 'node-5',
        type: 'Concept',
        label: 'Diffusion',
        content: 'Diffusion is the net movement of anything generally from a region of higher concentration to a region of lower concentration.',
        confidenceScore: 0.9,
        sourceChunkId: 'chunk-4',
        version: 'nv1',
        metadata: {}
      }
    ],
    edges: [
      {
        sourceNodeId: 'node-2',
        targetNodeId: 'node-1',
        type: 'DEFINES',
        confidenceScore: 0.9
      }
    ]
  };

  const mockEvidence: KnowledgeEvidence = {
    graph: mockGraph,
    knowledgeNodes: [],
    relationships: [],
    semanticChunks: [],
    flashcards: [],
    quizzes: [],
    citations: [],
    metadata: {
      documentId: mockGraph.metadata.documentId,
      originVersion: mockGraph.metadata.version,
      confidenceScore: 0.9,
    }
  };

  it('should generate multiple choice questions deterministically', () => {
    const questions = engine.generateQuestions(mockEvidence);
    
    const mcq = questions.find(q => q.type === 'mcq');
    expect(mcq).toBeDefined();
    expect(mcq?.front).toContain('What is the definition of Photosynthesis?');
    expect(mcq?.back).toBe('The process by which plants make their own food using sunlight.');
    expect(mcq?.options).toHaveLength(4); // 1 correct + 3 distractors
    expect(mcq?.options).toContain('The process by which plants make their own food using sunlight.');
  });

  it('should generate true/false questions deterministically', () => {
    const questions = engine.generateQuestions(mockEvidence);
    
    const tfQuestions = questions.filter(q => q.type === 'true_false');
    expect(tfQuestions.length).toBeGreaterThan(0);
    expect(tfQuestions[0].front).toContain('Is the following statement about');
    expect(['True', 'False']).toContain(tfQuestions[0].back);
    expect(tfQuestions[0].options).toEqual(['True', 'False']);
  });

  it('should generate fill in the blank questions deterministically', () => {
    const questions = engine.generateQuestions(mockEvidence);
    
    const fillBlankQuestions = questions.filter(q => q.type === 'fill_blank');
    expect(fillBlankQuestions.length).toBeGreaterThan(0);
    
    const photoQ = fillBlankQuestions.find(q => q.back === 'Photosynthesis');
    expect(photoQ).toBeDefined();
    expect(photoQ?.front).toContain('________ is the process');
  });

  it('should not generate mcq if not enough distractors', () => {
    const smallGraph: KnowledgeGraph = {
      ...mockGraph,
      nodes: mockGraph.nodes.slice(0, 2) // Only Photosynthesis and its definition
    };
    
    const smallEvidence = { ...mockEvidence, graph: smallGraph };
    const questions = engine.generateQuestions(smallEvidence);
    const mcq = questions.find(q => q.type === 'mcq');
    expect(mcq).toBeUndefined();
  });
});
