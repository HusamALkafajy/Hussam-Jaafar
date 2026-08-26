import { RevisionItem, DifficultyLevel } from '../revision-item';
import { MemoryState } from './memory-state';

export interface RevisionAlgorithmResult {
  nextReview: string;
  newMemoryState: MemoryState;
  newDifficulty: number;
}

export interface RevisionAlgorithm {
  calculateNextReview(item: RevisionItem, performance: DifficultyLevel): RevisionAlgorithmResult;
}

export class DeterministicRevisionAlgorithm implements RevisionAlgorithm {
  calculateNextReview(item: RevisionItem, performance: DifficultyLevel): RevisionAlgorithmResult {
    const now = new Date();
    let nextDate = new Date();
    let newState = item.memoryState;
    let newDifficulty = item.difficulty;

    if (performance === 'Again') {
      nextDate.setMinutes(now.getMinutes() + 10);
      newState = item.memoryState === 'Mastered' ? 'Lapsed' : 'Learning';
      newDifficulty = Math.max(1.3, item.difficulty - 0.2);
    } else if (performance === 'Hard') {
      nextDate.setDate(now.getDate() + 1);
      newState = 'Learning';
      newDifficulty = Math.max(1.3, item.difficulty - 0.15);
    } else if (performance === 'Good') {
      const interval = item.reviewCount === 0 ? 1 : item.reviewCount === 1 ? 3 : Math.round(item.reviewCount * item.difficulty);
      nextDate.setDate(now.getDate() + interval);
      newState = item.reviewCount > 3 ? 'Mastered' : 'Reviewing';
    } else if (performance === 'Easy') {
      const interval = item.reviewCount === 0 ? 4 : Math.round(item.reviewCount * item.difficulty * 1.3);
      nextDate.setDate(now.getDate() + interval);
      newState = 'Mastered';
      newDifficulty = item.difficulty + 0.15;
    }

    return {
      nextReview: nextDate.toISOString(),
      newMemoryState: newState,
      newDifficulty
    };
  }
}
