import { MemoryState, MemoryTransition } from './memory/memory-state';

export type RevisionItemStatus = 'Active' | 'Suspended' | 'Archived';
export type DifficultyLevel = 'Easy' | 'Good' | 'Hard' | 'Again';

export class RevisionItem {
  constructor(
    public readonly assetId: string,
    public memoryState: MemoryState = 'New',
    public reviewCount: number = 0,
    public lastReview: string | null = null,
    public nextReview: string | null = null,
    public difficulty: number = 2.5, // E-factor style initial difficulty
    public status: RevisionItemStatus = 'Active',
    public historyReference: string[] = [] // Array of AssessmentResult IDs or RevisionResult IDs
  ) {}

  updateMemoryState(newState: MemoryState, reason: string): MemoryTransition | null {
    if (this.memoryState === newState) return null;

    const transition: MemoryTransition = {
      from: this.memoryState,
      to: newState,
      timestamp: new Date().toISOString(),
      reason
    };

    this.memoryState = newState;
    return transition;
  }
}
