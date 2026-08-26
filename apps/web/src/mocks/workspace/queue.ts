import { MOCK_JOBS } from './jobs';

// Returns jobs that are currently active in the queue or processing
export const MOCK_ACTIVE_QUEUE = MOCK_JOBS.filter(job => job.status === 'queued' || job.status === 'processing');

// Returns recent jobs for the dashboard compact widget (max 5)
export const MOCK_RECENT_QUEUE = [...MOCK_JOBS].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
