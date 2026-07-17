export type Note = {
  id: string;
  title: string;
  preview: string;
  subjectId?: string;
  folderId?: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isFavorite: boolean;
};

export const MOCK_NOTES: Note[] = [
  { id: "note_1", title: "Midterm Study Guide", preview: "Focus on chapters 1-4. SN1 and SN2 reactions are heavily tested...", subjectId: "sub_1", createdAt: "2026-06-20T14:00:00Z", updatedAt: "2026-06-27T16:30:00Z", isPinned: true, isFavorite: true },
  { id: "note_2", title: "Piaget vs Vygotsky", preview: "Piaget emphasized stages of development, while Vygotsky focused on social learning...", subjectId: "sub_2", createdAt: "2026-06-18T09:15:00Z", updatedAt: "2026-06-18T10:45:00Z", isPinned: false, isFavorite: false },
  { id: "note_3", title: "Formula Sheet - Integration", preview: "Integration by parts: uv - int(v du). Trig substitutions...", subjectId: "sub_3", createdAt: "2026-06-25T11:00:00Z", updatedAt: "2026-06-26T08:20:00Z", isPinned: true, isFavorite: false },
  { id: "note_4", title: "Causes of WWI", preview: "Militarism, Alliances, Imperialism, Nationalism (MAIN)...", subjectId: "sub_4", createdAt: "2026-06-10T13:30:00Z", updatedAt: "2026-06-12T15:00:00Z", isPinned: false, isFavorite: true },
];
