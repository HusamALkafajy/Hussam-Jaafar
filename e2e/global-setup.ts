/**
 * Global Setup — runs once before all tests.
 * Verifies that all required services are reachable.
 * Does NOT seed the database — each test provisions its own data.
 */
import { chromium } from '@playwright/test';

async function globalSetup() {
  const apiBase = process.env.E2E_API_URL || 'http://localhost:4000';
  const webBase = process.env.E2E_WEB_URL || 'http://localhost:3000';

  console.log('\n🔍 StudyAI E2E Global Setup — verifying services...');

  // 1. Verify API health
  try {
    const res = await fetch(`${apiBase}/api/health`);
    if (!res.ok) throw new Error(`API health check returned ${res.status}`);
    console.log('  ✅ API server reachable');
  } catch (err) {
    throw new Error(
      `❌ API server not reachable at ${apiBase}/api/health.\n` +
      `   Start the backend: pnpm dev:api\n` +
      `   Error: ${err}`
    );
  }

  // 2. Verify Web server is reachable
  try {
    const res = await fetch(webBase);
    if (!res.ok && res.status !== 308 && res.status !== 307) {
      throw new Error(`Web server returned ${res.status}`);
    }
    console.log('  ✅ Web server reachable');
  } catch (err) {
    throw new Error(
      `❌ Web server not reachable at ${webBase}.\n` +
      `   Start the frontend: pnpm dev:web\n` +
      `   Error: ${err}`
    );
  }

  console.log('  ✅ All services verified. Beginning test run.\n');
}

export default globalSetup;
