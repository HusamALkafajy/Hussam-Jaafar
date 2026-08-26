export interface Bookmark {
  id: string;
  documentId: string;
  nodeId: string;
  title: string;
  createdAt: string;
}

export const MOCK_BOOKMARKS: Bookmark[] = [
  {
    id: 'bmk_1',
    documentId: 'doc_1',
    nodeId: 'node_12',
    title: 'DNA Structure - Key Diagram',
    createdAt: '2026-06-30T10:00:00Z',
  },
  {
    id: 'bmk_2',
    documentId: 'doc_1',
    nodeId: 'node_42',
    title: 'Krebs Cycle Summary',
    createdAt: '2026-06-30T10:30:00Z',
  }
];
