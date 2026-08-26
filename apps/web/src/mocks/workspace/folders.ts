export type Folder = {
  id: string;
  name: string;
  parentId?: string;
  subjectId?: string;
  createdAt: string;
};

export const MOCK_FOLDERS: Folder[] = [
  { id: "fold_1", name: "Lectures", subjectId: "sub_1", createdAt: "2026-06-01T10:00:00Z" },
  { id: "fold_2", name: "Assignments", subjectId: "sub_1", createdAt: "2026-06-01T10:05:00Z" },
  { id: "fold_3", name: "Readings", subjectId: "sub_2", createdAt: "2026-06-02T11:00:00Z" },
  { id: "fold_4", name: "Week 1-4", parentId: "fold_1", subjectId: "sub_1", createdAt: "2026-06-05T09:00:00Z" },
];
