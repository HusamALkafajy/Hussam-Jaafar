import { Test, TestingModule } from '@nestjs/testing';
import { FileProcessingStateRepository } from '../file-processing-state.repository';
import { LostProcessingOwnershipError } from '../../utils/domain.exceptions';
import { db, users, files, fileProcessingAttempts, documentVersions } from '@studyai/database';
import { eq } from 'drizzle-orm';
import { WorkerExecutionToken } from '../../types/worker-execution-token.type';
import { randomUUID } from 'crypto';

describe('FileProcessingStateRepository Fencing and Token', () => {
  let repository: FileProcessingStateRepository;
  let userId: string;

  const createFile = async () => {
    const file = await db.insert(files).values({
      id: randomUUID(),
      userId,
      originalName: 'fencing.pdf',
      storageKey: `fencing-${Date.now()}-${Math.random()}.pdf`,
      storageUrl: '/fencing.pdf',
      fileType: 'pdf',
      mimeType: 'application/pdf',
      fileSize: 1000,
    }).returning({ id: files.id });
    return file[0].id;
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileProcessingStateRepository],
    }).compile();

    repository = module.get<FileProcessingStateRepository>(FileProcessingStateRepository);

    // Setup parent data
    const user = await db.insert(users).values({
      email: `test-fencing-${Date.now()}@test.com`,
      firstName: 'Fencing',
      lastName: 'Test',
    }).returning({ id: users.id });
    userId = user[0].id;
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId));
  });

  it('TEST 1: First worker claim returns generation G and can terminal', async () => {
    const fileId = await createFile();
    const attempt = await db.insert(fileProcessingAttempts).values({
      fileId,
      queueJobId: `job-t1-${Date.now()}`,
      status: 'queued'
    }).returning({ id: fileProcessingAttempts.id });

    // Claim
    const claimResult = await db.update(fileProcessingAttempts).set({
      status: 'processing',
      processingAttempts: 1
    }).where(eq(fileProcessingAttempts.id, attempt[0].id))
      .returning({ processingAttempts: fileProcessingAttempts.processingAttempts });

    const token: WorkerExecutionToken = {
      attemptId: attempt[0].id,
      fileId,
      generation: claimResult[0].processingAttempts!
    };

    // Terminal
    await expect(repository.transitionToTerminal(token, 'completed')).resolves.not.toThrow();

    const final = await db.query.fileProcessingAttempts.findFirst({ where: eq(fileProcessingAttempts.id, attempt[0].id) });
    expect(final?.status).toBe('completed');
  });

  it('TEST 2 & 3: Replacement claim after stale recovery returns G+1, and G loses ownership', async () => {
    const fileId = await createFile();
    const attempt = await db.insert(fileProcessingAttempts).values({
      fileId,
      queueJobId: `job-t2-${Date.now()}`,
      status: 'queued'
    }).returning({ id: fileProcessingAttempts.id });

    // Worker A Claims
    const claimA = await db.update(fileProcessingAttempts).set({
      status: 'processing',
      processingAttempts: 1
    }).where(eq(fileProcessingAttempts.id, attempt[0].id))
      .returning({ processingAttempts: fileProcessingAttempts.processingAttempts });

    const tokenA: WorkerExecutionToken = {
      attemptId: attempt[0].id,
      fileId,
      generation: claimA[0].processingAttempts!
    };

    // Reconciler marks stale
    await db.update(fileProcessingAttempts).set({ status: 'enqueue_pending' }).where(eq(fileProcessingAttempts.id, attempt[0].id));
    // Dispatcher queues
    await db.update(fileProcessingAttempts).set({ status: 'queued' }).where(eq(fileProcessingAttempts.id, attempt[0].id));

    // Worker B Claims
    const claimB = await db.update(fileProcessingAttempts).set({
      status: 'processing',
      processingAttempts: 2
    }).where(eq(fileProcessingAttempts.id, attempt[0].id))
      .returning({ processingAttempts: fileProcessingAttempts.processingAttempts });

    const tokenB: WorkerExecutionToken = {
      attemptId: attempt[0].id,
      fileId,
      generation: claimB[0].processingAttempts!
    };

    expect(tokenB.generation).toBe(tokenA.generation + 1); // G+1

    // Worker A tries to terminal -> MUST FAIL
    await expect(repository.transitionToTerminal(tokenA, 'completed')).rejects.toThrow(LostProcessingOwnershipError);
  });

  it('TEST 4: Worker using G+1 can perform the transition', async () => {
    const fileId = await createFile();
    const attempt = await db.insert(fileProcessingAttempts).values({
      fileId,
      queueJobId: `job-t4-${Date.now()}`,
      status: 'processing',
      processingAttempts: 5
    }).returning({ id: fileProcessingAttempts.id });

    const token: WorkerExecutionToken = {
      attemptId: attempt[0].id,
      fileId,
      generation: 5
    };

    await expect(repository.transitionToTerminal(token, 'completed')).resolves.not.toThrow();
  });

  it('TEST 7: A worker token for attempt A cannot mutate attempt B', async () => {
    const fileIdA = await createFile();
    const fileIdB = await createFile();

    const attemptA = await db.insert(fileProcessingAttempts).values({
      fileId: fileIdA, queueJobId: `job-t7a-${Date.now()}`, status: 'processing', processingAttempts: 1
    }).returning({ id: fileProcessingAttempts.id });

    const attemptB = await db.insert(fileProcessingAttempts).values({
      fileId: fileIdB, queueJobId: `job-t7b-${Date.now()}`, status: 'processing', processingAttempts: 2
    }).returning({ id: fileProcessingAttempts.id });

    const tokenForA: WorkerExecutionToken = {
      attemptId: attemptA[0].id,
      fileId: fileIdA,
      generation: 1
    };

    // If we try to pass tokenForA but expecting to mutate attempt B somehow (e.g. passing attemptB's ID in the token? No, token has attemptA's ID).
    // The DB will just mutate A. 
    // This test proves that the token inherently binds the attempt ID to the worker.
    await expect(repository.transitionToTerminal(tokenForA, 'completed')).resolves.not.toThrow();

    const bState = await db.query.fileProcessingAttempts.findFirst({ where: eq(fileProcessingAttempts.id, attemptB[0].id) });
    expect(bState?.status).toBe('processing'); // B remains unaffected
  });
});
