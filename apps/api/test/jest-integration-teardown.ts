import { client } from '@studyai/database';

afterAll(async () => {
  await client.end({ timeout: 5 });
});
