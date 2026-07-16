import { AnswerPayload } from './assessment-attempt';

export class AnswerRegistry {
  private answers: Map<string, AnswerPayload> = new Map();

  store(answer: AnswerPayload) {
    this.answers.set(answer.questionId, answer);
  }

  retrieve(questionId: string): AnswerPayload | undefined {
    return this.answers.get(questionId);
  }

  getAll(): AnswerPayload[] {
    return Array.from(this.answers.values());
  }

  validateState(): boolean {
    return this.answers.size > 0;
  }
}
