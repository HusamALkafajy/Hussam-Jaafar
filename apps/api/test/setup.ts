/* eslint-disable no-restricted-syntax */
import { resolve } from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';

// Load test environment variables manually
const envPath = resolve(__dirname, '../.env.test');
const envFile = fs.readFileSync(envPath, 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.trim().match(/^([^=]+)="?(.*?)"?$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

export default async () => {
  console.log('\n--- TEST BOOTSTRAP START ---');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.includes('studyai_test')) {
    throw new Error('CRITICAL: DATABASE_URL is not configured for test environment. Aborting to protect dev data.');
  }

  console.log(`Connecting to test database: ${databaseUrl}`);

  // Execute Prisma migrations from monorepo root
  const rootDir = resolve(__dirname, '../../../');
  console.log(`Pushing latest schema from root: ${rootDir}`);
  try {
    console.log('Deploying Prisma schema directly using db push...');
    execSync('pnpm --filter=@studyai/infrastructure exec prisma db push --accept-data-loss', {
      cwd: rootDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });
    console.log('Prisma schema pushed successfully.');

    console.log('Pushing Drizzle schema directly to test DB...');
    execSync('pnpm --filter=@studyai/database exec drizzle-kit push --force', {
      cwd: rootDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });
    console.log('Drizzle schema pushed successfully.');
  } catch (error) {
    console.error('Failed to push schema:', error);
    throw error;
  }
  console.log('--- TEST BOOTSTRAP COMPLETE ---\n');
};
