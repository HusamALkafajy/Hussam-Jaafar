export type Document = {
  id: string;
  title: string;
  subjectId?: string;
  folderId?: string;
  type: 'pdf' | 'docx' | 'pptx' | 'image';
  sizeBytes: number;
  createdAt: string;
  isPinned: boolean;
};

export const MOCK_DOCUMENTS: Document[] = [
  { id: "doc_1", title: "Chapter 4: Reaction Mechanisms.pdf", subjectId: "sub_1", type: "pdf", sizeBytes: 2500000, createdAt: "2026-06-25T14:20:00Z", isPinned: true },
  { id: "doc_2", title: "Cognitive Development Summary.docx", subjectId: "sub_2", type: "docx", sizeBytes: 120000, createdAt: "2026-06-28T09:15:00Z", isPinned: false },
  { id: "doc_3", title: "Integration Techniques Lecture.pptx", subjectId: "sub_3", type: "pptx", sizeBytes: 8500000, createdAt: "2026-06-22T11:00:00Z", isPinned: false },
  { id: "doc_4", title: "WWII Timeline.pdf", subjectId: "sub_4", type: "pdf", sizeBytes: 4100000, createdAt: "2026-06-15T16:45:00Z", isPinned: true },
  { id: "doc_5", title: "Lab 2 Results.pdf", subjectId: "sub_1", type: "pdf", sizeBytes: 1500000, createdAt: "2026-06-29T08:30:00Z", isPinned: false },
];
