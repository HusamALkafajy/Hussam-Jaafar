import { MOCK_JOBS } from './jobs';

// Current active processing context (e.g. if the user is viewing a specific job in detail)
export const MOCK_ACTIVE_PROCESSING = MOCK_JOBS.find(j => j.id === 'job_2');
