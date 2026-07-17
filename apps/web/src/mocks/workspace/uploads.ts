export type Upload = {
  id: string;
  filename: string;
  sizeBytes: number;
  status: 'processing' | 'completed' | 'failed';
  uploadedAt: string;
};

export const MOCK_UPLOADS: Upload[] = [
  { id: "upl_1", filename: "Genetics Lecture 4.pdf", sizeBytes: 3500000, status: "completed", uploadedAt: "2026-06-29T10:15:00Z" },
  { id: "upl_2", filename: "Research_Methodology_Notes.docx", sizeBytes: 450000, status: "processing", uploadedAt: "2026-06-29T23:50:00Z" },
  { id: "upl_3", filename: "Physics Lab Data.xlsx", sizeBytes: 120000, status: "failed", uploadedAt: "2026-06-28T14:30:00Z" },
];
