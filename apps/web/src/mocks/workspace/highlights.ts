export interface Highlight {
  id: string;
  documentId: string;
  nodeId: string;
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'purple' | 'red';
  createdAt: string;
}

export const MOCK_HIGHLIGHTS: Highlight[] = [
  {
    id: 'hlt_1',
    documentId: 'doc_1',
    nodeId: 'node_5',
    text: 'DNA is transcribed into RNA, which is translated into protein.',
    color: 'yellow',
    createdAt: '2026-06-30T10:15:00Z',
  }
];
