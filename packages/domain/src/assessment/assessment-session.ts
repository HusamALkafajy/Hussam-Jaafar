import { AssessmentAttempt } from './assessment-attempt';
import { AssessmentResult } from './evaluation/assessment-result';

export class AssessmentSession {
  private currentIndex: number = 0;

  constructor(
    public readonly attempt: AssessmentAttempt,
    public readonly questionIds: string[]
  ) {}

  get currentQuestionId(): string | undefined {
    return this.questionIds[this.currentIndex];
  }

  get progress() {
    const answered = this.attempt.answers.length;
    return {
      currentQuestion: this.currentIndex + 1,
      totalQuestions: this.questionIds.length,
      answered,
      remaining: this.questionIds.length - answered,
      percentComplete: answered / this.questionIds.length
    };
  }

  start() {
    this.attempt.start();
  }

  pause() {
    this.attempt.pause();
  }

  resume() {
    this.attempt.resume();
  }

  next() {
    if (this.currentIndex < this.questionIds.length - 1) {
      this.currentIndex++;
    }
  }

  previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }
  }

  goTo(index: number) {
    if (index >= 0 && index < this.questionIds.length) {
      this.currentIndex = index;
    }
  }

  complete(result: AssessmentResult) {
    this.attempt.complete(result);
  }
}
