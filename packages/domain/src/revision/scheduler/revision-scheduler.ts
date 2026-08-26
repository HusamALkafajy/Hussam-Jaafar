import { RevisionQueue } from './revision-queue';
import { RevisionItem, DifficultyLevel } from '../revision-item';
import { RevisionAlgorithm } from '../memory/revision-algorithm';

export interface SchedulerOptions {
  dailyLimit?: number;
  batchSize?: number;
}

export class RevisionScheduler {
  constructor(
    private algorithm: RevisionAlgorithm,
    private queue: RevisionQueue
  ) {}

  /**
   * Generates a batch of items to review now.
   */
  getNextBatch(options: SchedulerOptions = {}): RevisionItem[] {
    const state = this.queue.getState();
    const batchSize = options.batchSize || 10;
    
    // Prioritize overdue, then today
    const candidates = [...state.overdue, ...state.today];
    
    // Apply limits
    let selected = candidates;
    if (options.dailyLimit && selected.length > options.dailyLimit) {
      selected = selected.slice(0, options.dailyLimit);
    }
    
    if (selected.length > batchSize) {
      selected = selected.slice(0, batchSize);
    }

    return selected;
  }

  /**
   * Processes a review and updates the item using the configured algorithm.
   */
  processReview(item: RevisionItem, performance: DifficultyLevel): RevisionItem {
    const result = this.algorithm.calculateNextReview(item, performance);
    
    item.reviewCount += 1;
    item.lastReview = new Date().toISOString();
    item.nextReview = result.nextReview;
    item.difficulty = result.newDifficulty;
    
    // update memory state
    item.updateMemoryState(result.newMemoryState, `Performance rated as ${performance}`);
    
    this.queue.addOrUpdateItem(item);
    
    return item;
  }
}
