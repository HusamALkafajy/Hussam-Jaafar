import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DRIZZLE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DRIZZLE_DATABASE_URL or DATABASE_URL must be supplied through the environment.');
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
