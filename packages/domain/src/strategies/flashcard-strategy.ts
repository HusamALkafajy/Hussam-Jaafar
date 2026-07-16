import { GenerationStrategy } from './generation-strategy';
import { LearningContextInterface } from '../learning-context-interface';
import { LearningArtifact } from '../learning-artifact';

export class FlashcardGenerationStrategy implements GenerationStrategy {
  async generate(context: LearningContextInterface): Promise<LearningArtifact[]> {
    // Deterministic mock generation based on context
    const frontText = context.focus.text ? `What is ${context.focus.text}?` : `What is the key concept of ${context.location.heading}?`;
    const backText = 'Mock back text based on context';
    
    return [
      {
        artifactType: 'Flashcard',
        content: { front: frontText, back: backText },
        metadata: { generatedBy: 'FlashcardStrategy' },
        sourceCitation: {
          documentId: context.documentId,
          chapterId: context.location.chapter || null,
          sectionId: context.location.section || null,
          headingId: context.location.heading || null,
          nodeId: context.location.nodeId,
          offsetStart: context.focus.offsets?.start || null,
          offsetEnd: context.focus.offsets?.end || null
        }
      }
    ];
  }
}
