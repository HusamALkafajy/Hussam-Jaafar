export interface Citation {
  documentId: string;
  chapterId: string | null;
  sectionId: string | null;
  headingId: string | null;
  nodeId: string;
  offsetStart: number | null;
  offsetEnd: number | null;
}

export const MOCK_CITATIONS: Record<string, Citation> = {
  'cit_1': {
    documentId: 'doc_1',
    chapterId: 'out_2',
    sectionId: 'out_2_2',
    headingId: 'node_42',
    nodeId: 'node_42',
    offsetStart: null,
    offsetEnd: null
  }
};
