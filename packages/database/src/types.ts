import { db } from './client';

export type Database = typeof db;
export type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * A shared transaction executor type capable of representing both 
 * the global database client and a transaction-scoped Drizzle executor.
 */
export type DatabaseExecutor = Database | DatabaseTransaction;
