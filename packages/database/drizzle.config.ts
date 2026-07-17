import { defineConfig } from 'drizzle-kit';


export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://studyai:studyai_dev_password@localhost:5432/studyai',
  },
  verbose: true,
  strict: true,
});
