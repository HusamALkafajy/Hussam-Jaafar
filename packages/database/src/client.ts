import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://studyai:studyai_dev_password@localhost:5432/studyai';

// Disable prefetch as recommended for serverless or general dev setup
export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
