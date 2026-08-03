/* eslint-disable no-restricted-syntax */
import { resolve } from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';

// Load test environment variables manually if they exist
const envPath = resolve(__dirname, '../.env.test');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.trim().match(/^([^=]+)="?(.*?)"?$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  });
}

export default async () => {
  console.log('\n--- TEST BOOTSTRAP START ---');
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.includes('studyai_test')) {
    throw new Error('CRITICAL: TEST_DATABASE_URL or DATABASE_URL must identify the isolated studyai_test database.');
  }

  process.env.DATABASE_URL = databaseUrl;

  const rootDir = resolve(__dirname, '../../../');
  console.log('Applying the Drizzle migration chain to the configured isolated test database.');
  try {
    execSync('pnpm --filter=@studyai/database run db:migrate', {
      cwd: rootDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });
    console.log('Drizzle migration chain completed.');
  } catch (error) {
    console.error('Failed to apply the Drizzle migration chain:', error);
    throw error;
  }
  console.log('--- TEST BOOTSTRAP COMPLETE ---\n');
};
