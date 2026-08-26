export type ActivityEvent = {
  id: string;
  type: 'upload' | 'read' | 'note' | 'ai_session' | 'flashcard' | 'quiz';
  title: string;
  description?: string;
  timestamp: string;
  targetId?: string;
};

export const MOCK_ACTIVITY: ActivityEvent[] = [
  { id: "act_1", type: "read", title: "Read Chapter 4: Reaction Mechanisms", timestamp: "2026-06-29T21:30:00Z", targetId: "doc_1" },
  { id: "act_2", type: "upload", title: "Uploaded Genetics Lecture 4.pdf", timestamp: "2026-06-29T10:15:00Z", targetId: "upl_1" },
  { id: "act_3", type: "ai_session", title: "Chatted with AI Tutor", description: "Topic: SN2 vs SN1 mechanisms", timestamp: "2026-06-28T16:45:00Z" },
  { id: "act_4", type: "note", title: "Created Note: Piaget vs Vygotsky", timestamp: "2026-06-28T09:15:00Z", targetId: "note_2" },
  { id: "act_5", type: "quiz", title: "Completed Quiz: World History", description: "Score: 92%", timestamp: "2026-06-27T14:20:00Z" },
];
