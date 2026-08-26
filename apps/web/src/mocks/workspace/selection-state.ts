export interface SelectionState {
  text: string | null;
  nodeId: string | null;
  range: { start: number; end: number } | null;
  timestamp: string | null;
}

export const MOCK_SELECTION_STATE: SelectionState = {
  text: 'The mitochondria is the powerhouse of the cell.',
  nodeId: 'node_42',
  range: { start: 10, end: 55 },
  timestamp: '2026-07-01T10:05:00Z'
};
