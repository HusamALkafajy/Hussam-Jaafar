import { MOCK_SUBJECTS } from './subjects';
import { MOCK_DOCUMENTS } from './documents';
import { MOCK_STATISTICS } from './statistics';
import { MOCK_ACTIVITY } from './activity';

export const MOCK_DASHBOARD_DATA = {
  welcomeMessage: "Ready to continue your learning journey?",
  statistics: MOCK_STATISTICS,
  recentDocuments: MOCK_DOCUMENTS.slice(0, 3),
  pinnedDocuments: MOCK_DOCUMENTS.filter(doc => doc.isPinned),
  recentSubjects: MOCK_SUBJECTS.slice(0, 3),
  activityFeed: MOCK_ACTIVITY,
  upcomingReviews: [
    { id: "rev_1", title: "Organic Chemistry Midterm", date: "2026-07-05T09:00:00Z" },
    { id: "rev_2", title: "Psychology Essay Draft", date: "2026-07-08T23:59:00Z" }
  ]
};
