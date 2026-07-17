export type Subject = {
  id: string;
  name: string;
  color: string;
  icon: string;
  documentCount: number;
  lastAccessed: string;
};

export const MOCK_SUBJECTS: Subject[] = [
  { id: "sub_1", name: "Organic Chemistry 101", color: "blue", icon: "flask-conical", documentCount: 12, lastAccessed: "2026-06-28T10:00:00Z" },
  { id: "sub_2", name: "Introduction to Psychology", color: "purple", icon: "brain", documentCount: 8, lastAccessed: "2026-06-29T14:30:00Z" },
  { id: "sub_3", name: "Calculus II", color: "green", icon: "function-square", documentCount: 15, lastAccessed: "2026-06-25T09:15:00Z" },
  { id: "sub_4", name: "World History", color: "orange", icon: "globe", documentCount: 24, lastAccessed: "2026-06-20T11:45:00Z" },
];
