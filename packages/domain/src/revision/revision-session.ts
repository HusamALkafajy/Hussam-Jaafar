import { RevisionItem, DifficultyLevel } from './revision-item';
import { RevisionScheduler } from './scheduler/revision-scheduler';
import { RevisionTimeline } from './revision-timeline';
import { RevisionResult } from './revision-result';

export type RevisionSessionStatus = 'NotStarted' | 'InProgress' | 'Paused' | 'Completed';

export class RevisionSession {
  public status: RevisionSessionStatus = 'NotStarted';
  private currentIndex: number = 0;
  private startedAt?: number;
  private correctCount: number = 0;
  
  constructor(
    public readonly sessionId: string,
    public readonly batch: RevisionItem[],
    private scheduler: RevisionScheduler,
    public readonly timeline: RevisionTimeline
  ) {}

  get currentItem(): RevisionItem | undefined {
    return this.batch[this.currentIndex];
  }

  get progress() {
    return {
      reviewed: this.currentIndex,
      remaining: this.batch.length - this.currentIndex,
      total: this.batch.length,
      percentComplete: this.batch.length > 0 ? this.currentIndex / this.batch.length : 1
    };
  }

  start() {
    if (this.status === 'NotStarted') {
      this.status = 'InProgress';
      this.startedAt = Date.now();
      this.timeline.append('revision.started', { sessionId: this.sessionId, batchSize: this.batch.length });
    }
  }

  pause() {
    if (this.status === 'InProgress') {
      this.status = 'Paused';
    }
  }

  resume() {
    if (this.status === 'Paused') {
      this.status = 'InProgress';
    }
  }

  skip() {
    if (this.status !== 'InProgress') return;
    const item = this.currentItem;
    if (item) {
      this.timeline.append('item.skipped', { assetId: item.assetId });
      this.currentIndex++;
    }
  }

  reviewCurrentItem(performance: DifficultyLevel) {
    if (this.status !== 'InProgress') return;
    
    const item = this.currentItem;
    if (!item) return;

    if (performance === 'Good' || performance === 'Easy') {
      this.correctCount++;
    }

    const updatedItem = this.scheduler.processReview(item, performance);
    
    this.timeline.append('item.reviewed', { 
      assetId: updatedItem.assetId,
      performance,
      newMemoryState: updatedItem.memoryState,
      nextReview: updatedItem.nextReview
    });

    this.currentIndex++;
  }

  complete(): RevisionResult | null {
    if (this.currentIndex < this.batch.length && this.status !== 'Completed') {
      // Not all items reviewed, could optionally auto-skip remaining
      return null;
    }

    this.status = 'Completed';
    const durationSeconds = this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0;
    
    this.timeline.append('revision.completed', { sessionId: this.sessionId });

    return {
      sessionId: this.sessionId,
      completionRate: this.progress.percentComplete,
      accuracy: this.batch.length > 0 ? this.correctCount / this.batch.length : 1,
      reviewDurationSeconds: durationSeconds,
      reviewedAssetIds: this.batch.slice(0, this.currentIndex).map(i => i.assetId),
      generatedAt: new Date().toISOString()
    };
  }
}
