# StudyAI Integration Testing

This repository uses a dedicated, isolated PostgreSQL database for integration tests.

## 1. Start the Test Database
Start the dedicated `postgres-test` container (disposable, no persistent volume):
```bash
docker-compose up -d postgres-test
```

## 2. Execute Integration Tests
Run the integration tests. This command will automatically:
- Load `.env.test`
- Connect to `studyai_test` on port `5434`
- Migrate the latest Drizzle schema (`db:migrate`)
- Run the Jest integration test suite in parallel
```bash
pnpm --filter=@studyai/api test:integration
```

## 3. How Cleanup Works
- The test database container (`postgres-test`) uses a `tmpfs` RAM disk and does not map to any local disk volume.
- Restarting or destroying the container instantly wipes all test data and guarantees a completely fresh state:
  ```bash
  docker-compose stop postgres-test
  docker-compose rm -f -v postgres-test
  ```
- Individual integration tests MUST isolate themselves either by wrapping execution in rollback transactions or by using mathematically unique UUIDs for all seeded data.
