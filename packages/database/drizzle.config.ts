import { defineConfig } from 'drizzle-kit';


export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DRIZZLE_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://studyai_dev:studyai_dev_password@127.0.0.1:5433/studyai_dev',
  },
  verbose: true,
  strict: true,
});
