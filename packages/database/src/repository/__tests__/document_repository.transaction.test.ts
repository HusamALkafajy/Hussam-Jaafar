import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DocumentRepository } from '../document_repository';
import { db, client } from '../../client';
import { documentNodes, files, users, documentVersions } from '../../schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('DocumentRepository Transaction Executor', () => {
  let repository: DocumentRepository;
  let userId: string;
  let fileId: string;

  beforeAll(async () => {
    repository = new DocumentRepository();

    const user = await db.insert(users).values({
      email: `test-tx-${Date.now()}@test.com`,
      firstName: 'Tx',
      lastName: 'Test',
    }).returning({ id: users.id });
    userId = user[0].id;

    const file = await db.insert(files).values({
      id: randomUUID(),
      userId,
      originalName: 'tx.pdf',
      storageKey: 'tx.pdf',
      storageUrl: '/tx.pdf',
      fileType: 'pdf',
      mimeType: 'application/pdf',
      fileSize: 1000,
    }).returning({ id: files.id });
    fileId = file[0].id;
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId));
  });

  it('TEST 1: DocumentRepository uses the supplied transaction executor', async () => {
    // Need a version for the node
    const version = await db.insert(documentVersions).values({
      id: randomUUID(),
      fileId,
      versionNumber: 1,
    }).returning({ id: documentVersions.id });
    const versionId = version[0].id;

    await db.transaction(async (tx) => {
      const result = await repository.persistNodes([{
        id: randomUUID(),
        fileId,
        versionId,
        nodeType: 'paragraph',
        lexoRank: '1',
        content: {},
        metadata: {}
      }], tx);
      if (!result.success) console.error(result.error);
      expect(result.success).toBe(true);
    });

    const nodes = await db.query.documentNodes.findMany({ where: eq(documentNodes.fileId, fileId) });
    expect(nodes.length).toBeGreaterThanOrEqual(1);
  });

  it('TEST 2: A node write performed through the repository rolls back when the outer transaction throws', async () => {
    const errorMsg = 'Intentional Rollback';
    const testNodeId = randomUUID();
    const versionId = (await db.query.documentVersions.findFirst({ where: eq(documentVersions.fileId, fileId) }))!.id;

    try {
      await db.transaction(async (tx) => {
        await repository.persistNodes([{
          id: testNodeId,
          fileId,
          versionId,
          nodeType: 'paragraph',
          lexoRank: '2',
          content: {},
          metadata: {}
        }], tx);
        throw new Error(errorMsg);
      });
    } catch (e: any) {
      expect(e.message).toBe(errorMsg);
    }

    const node = await db.query.documentNodes.findFirst({ where: eq(documentNodes.id, testNodeId) });
    expect(node).toBeUndefined(); // Rolled back!
  });

  it('TEST 4: Default repository calls without tx continue working', async () => {
    const testNodeId = randomUUID();
    const versionId = (await db.query.documentVersions.findFirst({ where: eq(documentVersions.fileId, fileId) }))!.id;

    const result = await repository.persistNodes([{
      id: testNodeId,
      fileId,
      versionId,
      nodeType: 'paragraph',
      lexoRank: '3',
      content: {},
      metadata: {}
    }]);

    if (!result.success) console.error(result.error);
    expect(result.success).toBe(true);
    const node = await db.query.documentNodes.findFirst({ where: eq(documentNodes.id, testNodeId) });
    expect(node).toBeDefined();
  });
});
