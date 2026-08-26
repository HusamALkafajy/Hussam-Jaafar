export interface ReaderDocumentInfo {
  id: string;
  title: string;
  totalPages: number;
  estimatedTotalTimeMinutes: number;
  totalSections: number;
}

export const MOCK_READER_DOC: ReaderDocumentInfo = {
  id: 'doc_1',
  title: 'Biology_101_Midterm_Notes.pdf',
  totalPages: 32,
  estimatedTotalTimeMinutes: 45,
  totalSections: 24,
};
