import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../client';
import { files, users, fileProcessingAttempts, documentVersions } from '../../index';
import { eq, isNull } from 'drizzle-orm';

describe('Publication Identity Schema Constraints', () => {
  let userId: string;
  let fileIdA: string;
  let fileIdB: string;

  beforeAll(async () => {
    const user = await db.insert(users).values({
      email: `test-${Date.now()}@test.com`,
      firstName: 'Test',
      lastName: 'User'
    }).returning({ id: users.id });
    userId = user[0].id;

    const fileA = await db.insert(files).values({
      userId,
      originalName: 'fileA.pdf',
      storageKey: 'fileA.pdf',
      storageUrl: '/fileA.pdf',
      fileType: 'pdf',
      mimeType: 'application/pdf',
      fileSize: 1000
    }).returning({ id: files.id });
    fileIdA = fileA[0].id;

    const fileB = await db.insert(files).values({
      userId,
      originalName: 'fileB.pdf',
      storageKey: 'fileB.pdf',
      storageUrl: '/fileB.pdf',
      fileType: 'pdf',
      mimeType: 'application/pdf',
      fileSize: 1000
    }).returning({ id: files.id });
    fileIdB = fileB[0].id;
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId));
  });

  it('TEST 1: A valid processing attempt can own one document version', async () => {
    const attempt = await db.insert(fileProcessingAttempts).values({
      fileId: fileIdA,
      queueJobId: `job-1-${Date.now()}`,
      status: 'completed'
    }).returning({ id: fileProcessingAttempts.id });

    const attemptId = attempt[0].id;

    const version = await db.insert(documentVersions).values({
      fileId: fileIdA,
      versionNumber: 1,
      attemptId
    }).returning({ id: documentVersions.id });

    expect(version.length).toBe(1);
    expect(version[0].id).toBeDefined();
  });

  it('TEST 2: The same attempt cannot own two document versions', async () => {
    const attempt = await db.insert(fileProcessingAttempts).values({
      fileId: fileIdA,
      queueJobId: `job-2-${Date.now()}`,
      status: 'completed'
    }).returning({ id: fileProcessingAttempts.id });

    const attemptId = attempt[0].id;

    await db.insert(documentVersions).values({
      fileId: fileIdA,
      versionNumber: 2,
      attemptId
    });

    await expect(
      db.insert(documentVersions).values({
        fileId: fileIdA,
        versionNumber: 3,
        attemptId
      })
    ).rejects.toThrow(/unique constraint|duplicate key/i);
  });

  it('TEST 3: Two different attempts for the same file can own two different versions', async () => {
    const attempt1 = await db.insert(fileProcessingAttempts).values({
      fileId: fileIdA,
      queueJobId: `job-3a-${Date.now()}`,
      status: 'completed'
    }).returning({ id: fileProcessingAttempts.id });
    
    const attempt2 = await db.insert(fileProcessingAttempts).values({
      fileId: fileIdA,
      queueJobId: `job-3b-${Date.now()}`,
      status: 'completed'
    }).returning({ id: fileProcessingAttempts.id });

    await db.insert(documentVersions).values({
      fileId: fileIdA,
      versionNumber: 4,
      attemptId: attempt1[0].id
    });

    const v5 = await db.insert(documentVersions).values({
      fileId: fileIdA,
      versionNumber: 5,
      attemptId: attempt2[0].id
    }).returning({ id: documentVersions.id });

    expect(v5.length).toBe(1);
  });

  it('TEST 4: DB schema permits cross-file mismatch (requires application-level validation)', async () => {
    const attemptForA = await db.insert(fileProcessingAttempts).values({
      fileId: fileIdA,
      queueJobId: `job-4-${Date.now()}`,
      status: 'completed'
    }).returning({ id: fileProcessingAttempts.id });

    const version = await db.insert(documentVersions).values({
      fileId: fileIdB,
      versionNumber: 1, // fileB's first version
      attemptId: attemptForA[0].id
    }).returning({ id: documentVersions.id });

    expect(version.length).toBe(1);
  });

  it('TEST 5: Delete behavior (ON DELETE SET NULL) for the attempt/version relationship', async () => {
    const attempt = await db.insert(fileProcessingAttempts).values({
      fileId: fileIdA,
      queueJobId: `job-5-${Date.now()}`,
      status: 'completed'
    }).returning({ id: fileProcessingAttempts.id });

    const version = await db.insert(documentVersions).values({
      fileId: fileIdA,
      versionNumber: 6,
      attemptId: attempt[0].id
    }).returning({ id: documentVersions.id });

    expect(version[0].id).toBeDefined();

    await db.delete(fileProcessingAttempts).where(eq(fileProcessingAttempts.id, attempt[0].id));

    const fetchedVersion = await db.select().from(documentVersions).where(eq(documentVersions.id, version[0].id));
    expect(fetchedVersion[0].attemptId).toBeNull();
  });

  it('TEST 6: Multiple historical NULL rows remain valid while non-null attempt IDs remain unique', async () => {
    await db.insert(documentVersions).values({
      fileId: fileIdA,
      versionNumber: 7,
      attemptId: null
    });
    
    await db.insert(documentVersions).values({
      fileId: fileIdA,
      versionNumber: 8,
      attemptId: null
    });

    const nullVersions = await db.select().from(documentVersions).where(isNull(documentVersions.attemptId));
    expect(nullVersions.length).toBeGreaterThanOrEqual(2);
  });
});
