import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from '../../knowledge/contracts/knowledge-graph';
import { KnowledgeEvidence } from '../../knowledge/contracts/knowledge-evidence';
import { QuizQuestionAsset, QuestionType } from './contracts/quiz';
import * as crypto from 'crypto';

export class QuizEngine {
  /**
   * Generates a deterministic set of Quiz questions from the Canonical Knowledge Evidence.
   */
  public generateQuestions(evidence: KnowledgeEvidence): QuizQuestionAsset[] {
    const questions: QuizQuestionAsset[] = [];
    const graph = evidence.graph;
    
    if (!graph || !graph.nodes || !graph.edges) {
      return questions;
    }

    const nodeMap = new Map<string, KnowledgeNode>();
    const concepts: KnowledgeNode[] = [];
    
    for (const node of graph.nodes) {
      nodeMap.set(node.id, node);
      if (node.type === 'Concept') {
        concepts.push(node);
      }
    }

    // Process nodes directly
    for (const node of graph.nodes) {
      if (node.type === 'Concept' && node.content && node.content.trim().length > 10) {
        // True/False
        const tfQuestion = this.generateTrueFalse(graph, node, concepts);
        if (tfQuestion) questions.push(tfQuestion);

        // Fill in the Blank
        if (node.label && node.content.toLowerCase().includes(node.label.toLowerCase())) {
          const fillBlankQuestion = this.generateFillInTheBlank(graph, node);
          if (fillBlankQuestion) questions.push(fillBlankQuestion);
        }
      }
    }

    // Process edges
    for (const edge of graph.edges) {
      const source = nodeMap.get(edge.sourceNodeId);
      const target = nodeMap.get(edge.targetNodeId);

      if (!source || !target) continue;

      if (edge.type === 'DEFINES' && source.type === 'Definition' && target.type === 'Concept') {
        // MCQ: "What is the definition of X?"
        const mcqQuestion = this.generateDefinitionMCQ(graph, source, target, concepts);
        if (mcqQuestion) questions.push(mcqQuestion);
      }
    }

    return this.deduplicateQuestions(questions);
  }

  private generateDefinitionMCQ(
    graph: KnowledgeGraph,
    definitionNode: KnowledgeNode,
    conceptNode: KnowledgeNode,
    allConcepts: KnowledgeNode[]
  ): QuizQuestionAsset | null {
    // We need 3 distractors
    const otherConcepts = allConcepts.filter(c => c.id !== conceptNode.id && c.content && c.content.length > 5);
    
    if (otherConcepts.length < 3) {
      return null; // Skip if we can't reliably generate distractors
    }

    // Deterministically shuffle and pick 3 using a hash
    const hashStr = crypto.createHash('md5').update(definitionNode.id + conceptNode.id).digest('hex');
    const seed = parseInt(hashStr.substring(0, 8), 16);
    
    const shuffled = [...otherConcepts].sort((a, b) => {
      const hA = parseInt(crypto.createHash('md5').update(a.id + seed).digest('hex').substring(0, 8), 16);
      const hB = parseInt(crypto.createHash('md5').update(b.id + seed).digest('hex').substring(0, 8), 16);
      return hA - hB;
    });

    const distractors = shuffled.slice(0, 3).map(c => c.content);
    const correctAnswer = definitionNode.content;

    const options = [correctAnswer, ...distractors];
    // Deterministically shuffle options
    options.sort((a, b) => {
      const hA = parseInt(crypto.createHash('md5').update(a + seed).digest('hex').substring(0, 8), 16);
      const hB = parseInt(crypto.createHash('md5').update(b + seed).digest('hex').substring(0, 8), 16);
      return hA - hB;
    });

    return this.createDraftQuestion(
      graph,
      definitionNode,
      'mcq',
      `What is the definition of ${conceptNode.label}?`,
      correctAnswer,
      options
    );
  }

  private generateTrueFalse(
    graph: KnowledgeGraph,
    conceptNode: KnowledgeNode,
    allConcepts: KnowledgeNode[]
  ): QuizQuestionAsset | null {
    // 50% chance to be true, 50% chance to be false (swapped definition)
    const hash = crypto.createHash('md5').update(conceptNode.id + 'tf').digest('hex');
    const isTrue = parseInt(hash.substring(0, 1), 16) % 2 === 0;

    let statement = conceptNode.content;
    let correctAnswer = 'True';

    if (!isTrue) {
      const otherConcepts = allConcepts.filter(c => c.id !== conceptNode.id && c.content && c.content.length > 5);
      if (otherConcepts.length === 0) return null;

      const seed = parseInt(hash.substring(0, 8), 16);
      const swappedConcept = otherConcepts[seed % otherConcepts.length];
      
      statement = swappedConcept.content;
      correctAnswer = 'False';
    }

    return this.createDraftQuestion(
      graph,
      conceptNode,
      'true_false',
      `Is the following statement about ${conceptNode.label} true or false?\n\n"${statement}"`,
      correctAnswer,
      ['True', 'False']
    );
  }

  private generateFillInTheBlank(graph: KnowledgeGraph, conceptNode: KnowledgeNode): QuizQuestionAsset | null {
    if (!conceptNode.label) return null;
    const regex = new RegExp(`\\b${this.escapeRegExp(conceptNode.label)}\\b`, 'gi');
    const front = conceptNode.content.replace(regex, '________');
    
    // If no replacement happened
    if (front === conceptNode.content) return null;

    return this.createDraftQuestion(
      graph,
      conceptNode,
      'fill_blank',
      front,
      conceptNode.label
    );
  }

  private createDraftQuestion(
    graph: KnowledgeGraph,
    primaryNode: KnowledgeNode,
    type: QuestionType,
    front: string,
    back: string,
    options?: string[]
  ): QuizQuestionAsset {
    const cleanFront = front.trim();
    const cleanBack = back.trim();

    const hashPayload = `${graph.metadata.documentId}:${type}:${cleanFront}:${cleanBack}:${primaryNode.id}`;
    const quizQuestionId = crypto.createHash('sha256').update(hashPayload).digest('hex');
    const version = crypto.createHash('sha256').update(hashPayload + `:${graph.metadata.version}`).digest('hex');

    return {
      quizQuestionId,
      knowledgeNodeId: primaryNode.id,
      knowledgeNodeVersion: primaryNode.version,
      originGraphVersion: graph.metadata.version,
      type,
      front: cleanFront,
      back: cleanBack,
      options,
      sourceReferences: [primaryNode.sourceChunkId],
      version
    };
  }

  private deduplicateQuestions(questions: QuizQuestionAsset[]): QuizQuestionAsset[] {
    const unique = new Map<string, QuizQuestionAsset>();
    for (const q of questions) {
      if (!unique.has(q.quizQuestionId)) {
        unique.set(q.quizQuestionId, q);
      }
    }
    return Array.from(unique.values());
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
