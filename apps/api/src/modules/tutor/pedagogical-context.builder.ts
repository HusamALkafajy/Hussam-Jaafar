import { Injectable } from '@nestjs/common';
import { TutorEvidence } from './contracts/tutor-evidence';

@Injectable()
export class PedagogicalContextBuilder {
  
  buildContext(evidence: TutorEvidence): string {
    let contextParts: string[] = [];

    contextParts.push(`=== PEDAGOGICAL CONTEXT ===`);
    contextParts.push(`Document ID: ${evidence.metadata.documentId}`);
    contextParts.push(`Relevance Confidence: ${evidence.metadata.confidenceScore.toFixed(2)}\n`);

    // 1. Knowledge Nodes (Primary Conceptual Foundation)
    if (evidence.knowledgeNodes.length > 0) {
      contextParts.push(`[KNOWLEDGE CONCEPTS]`);
      evidence.knowledgeNodes.forEach(node => {
        contextParts.push(`- ${node.type}: ${node.label} \n  Content: ${node.content}`);
      });
      contextParts.push('');
    }

    // 2. Semantic Chunks (Detailed Context)
    if (evidence.semanticChunks.length > 0) {
      contextParts.push(`[DOCUMENT EXCERPTS]`);
      evidence.semanticChunks.forEach((chunk, index) => {
        contextParts.push(`Excerpt ${index + 1} (Page ${chunk.page}):\n"${chunk.content}"\n`);
        evidence.citations.push(`Page ${chunk.page}`);
      });
      contextParts.push('');
    }

    // 3. Flashcards (Recommended Study Material)
    if (evidence.flashcards.length > 0) {
      contextParts.push(`[RELATED FLASHCARDS]`);
      evidence.flashcards.forEach((card, index) => {
        contextParts.push(`Flashcard ${index + 1}:\nFront: ${card.payload.front}\nBack: ${card.payload.back}\n`);
      });
      contextParts.push('');
    }

    // 4. Quizzes (Assessment Opportunities)
    if (evidence.quizzes.length > 0) {
      contextParts.push(`[RELATED QUIZ QUESTIONS]`);
      evidence.quizzes.forEach((quiz, index) => {
        contextParts.push(`Question ${index + 1}: ${quiz.payload.front}`);
        if (quiz.payload.options && quiz.payload.options.length > 0) {
           const opts = quiz.payload.options.join(', ');
           contextParts.push(`Options: ${opts}`);
        }
        contextParts.push(`Answer: ${quiz.payload.back}\n`);
      });
      contextParts.push('');
    }

    // Remove duplicate citations
    evidence.citations = [...new Set(evidence.citations)];

    return contextParts.join('\n');
  }
}
