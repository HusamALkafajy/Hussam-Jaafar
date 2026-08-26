import { Injectable } from '@nestjs/common';

@Injectable()
export class RecommendationExplanationProvider {
  explainSpacedRepetition(count: number): string {
    return `You have ${count} flashcards due for review. Consistent spaced repetition improves long-term memory retention.`;
  }

  explainLowQuizScore(score: number): string {
    return `Your last quiz score was ${score}%. Retrying quizzes helps solidify weak areas.`;
  }

  explainTutorRemediation(topic: string): string {
    return `You've recently struggled with questions about ${topic}. An AI Tutor session can clarify misunderstandings.`;
  }

  explainSessionContinuation(resourceTitle: string): string {
    return `Pick up where you left off with "${resourceTitle}".`;
  }
}
