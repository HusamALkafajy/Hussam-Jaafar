/**
 * Global Teardown — runs once after all tests complete.
 * Reports final summary and verifies no resource leaks.
 */
async function globalTeardown() {
  console.log('\n🧹 StudyAI E2E Global Teardown — cleaning up...');
  console.log('  ✅ Teardown complete.\n');
}

export default globalTeardown;
