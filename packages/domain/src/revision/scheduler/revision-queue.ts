import { RevisionItem } from '../revision-item';

export interface RevisionQueueState {
  today: RevisionItem[];
  upcoming: RevisionItem[];
  overdue: RevisionItem[];
  completed: RevisionItem[];
  deferred: RevisionItem[];
}

export class RevisionQueue {
  private items: Map<string, RevisionItem> = new Map();

  constructor(items: RevisionItem[] = []) {
    items.forEach(item => this.items.set(item.assetId, item));
  }

  addOrUpdateItem(item: RevisionItem) {
    this.items.set(item.assetId, item);
  }

  getItem(assetId: string): RevisionItem | undefined {
    return this.items.get(assetId);
  }

  getState(): RevisionQueueState {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const today: RevisionItem[] = [];
    const upcoming: RevisionItem[] = [];
    const overdue: RevisionItem[] = [];
    const completed: RevisionItem[] = [];
    const deferred: RevisionItem[] = [];

    this.items.forEach(item => {
      if (item.status === 'Suspended') {
        deferred.push(item);
        return;
      }

      if (!item.nextReview) {
        today.push(item);
        return;
      }

      const nextDateStr = item.nextReview.split('T')[0];
      const nextDate = new Date(nextDateStr);
      const todayDate = new Date(todayStr);

      if (item.lastReview && item.lastReview.split('T')[0] === todayStr) {
        completed.push(item);
      } else if (nextDate < todayDate) {
        overdue.push(item);
      } else if (nextDateStr === todayStr) {
        today.push(item);
      } else {
        upcoming.push(item);
      }
    });

    // Deterministic ordering: Overdue first (oldest), then Today, then Upcoming
    overdue.sort((a, b) => (a.nextReview || '').localeCompare(b.nextReview || ''));
    today.sort((a, b) => (a.nextReview || '').localeCompare(b.nextReview || ''));
    upcoming.sort((a, b) => (a.nextReview || '').localeCompare(b.nextReview || ''));

    return { today, upcoming, overdue, completed, deferred };
  }
}
