export type MemoryState = 'New' | 'Learning' | 'Reviewing' | 'Mastered' | 'Lapsed';

export interface MemoryTransition {
  from: MemoryState;
  to: MemoryState;
  timestamp: string;
  reason: string;
}
