import { Test, TestingModule } from '@nestjs/testing';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.JWT_SECRET = 'test_jwt_secret_mock_12345';
process.env.DATABASE_URL = 'postgresql://studyai_test:studyai_test_password@127.0.0.1:5434/studyai_test';
import { INestApplication, ValidationPipe, ConflictException } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { db, users, files, exams, questions, eq } from '@studyai/database';
import { JwtService } from '@nestjs/jwt';
import { AiService } from '../../ai/ai.service';
import { v4 as uuidv4 } from 'uuid';

describe('Exams Submission Concurrency (e2e)', () => {
  jest.setTimeout(30000); // 30s timeout to prevent flakiness under load
  let app: INestApplication;
  let jwtService: JwtService;
  
  // Test data IDs
  const testUserId = uuidv4();
  const testEmail = `test-concurrency-${Date.now()}@example.com`;
  const fileId = uuidv4();
  
  let token: string;

  // AI mock controller
  let resolveAi: (val: any) => void = () => {};
  let rejectAi: (err: any) => void = () => {};
  let aiPromise: Promise<any> | null = null;
  let aiCallCount = 0;

  beforeAll(async () => {
    const mockAiService = {
      generateExamFeedback: jest.fn().mockImplementation(() => {
        aiCallCount++;
        aiPromise = new Promise((resolve, reject) => {
          resolveAi = resolve;
          rejectAi = reject;
        });
        return aiPromise;
      }),
      // other methods can just resolve
      generateExam: jest.fn().mockResolvedValue({}),
      generateAdaptiveQuestion: jest.fn().mockResolvedValue({}),
      getEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
      isMockMode: jest.fn().mockReturnValue(true),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiService)
      .useValue(mockAiService)
      .overrideProvider('IWorkerRuntimeEngine')
      .useValue({ start: jest.fn(), stop: jest.fn(), pause: jest.fn(), resume: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await app.listen(0);

    jwtService = app.get(JwtService);

    // Setup base user and file
    await db.insert(users).values({
      id: testUserId,
      email: testEmail,
      firstName: 'Test',
      lastName: 'Concurrency'
    });

    await db.insert(files).values({
      id: fileId,
      userId: testUserId,
      originalName: 'test.pdf',
      storageKey: 'test/test.pdf',
      storageUrl: 'http://test/test.pdf',
      fileType: 'pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      extractedText: 'dummy text',
    });

    token = jwtService.sign({ sub: testUserId, email: testEmail });
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, testUserId));
    await app.close();
  });

  const createExam = async () => {
    const examId = uuidv4();
    await db.insert(exams).values({
      id: examId,
      fileId,
      userId: testUserId,
      title: 'Concurrency Test Exam',
      difficulty: 'medium',
      totalQuestions: 1,
      status: 'active',
      evaluationVersion: 0,
    });

    const questionId = uuidv4();
    await db.insert(questions).values({
      id: questionId,
      examId,
      type: 'mcq',
      questionText: 'What is 1+1?',
      options: ['1', '2', '3', '4'],
      correctAnswer: '2',
      difficulty: 'medium',
      orderIndex: 0,
      points: 1,
    });

    return { examId, questionId };
  };

  beforeEach(() => {
    aiCallCount = 0;
    resolveAi = () => {};
    rejectAi = () => {};
  });

  describe('Part 3 & 4: Simultaneous Submissions', () => {
    it('exactly 1 of 2 simultaneous requests acquires ownership', async () => {
      const { examId, questionId } = await createExam();
      const url = await app.getUrl();
      
      const payload1 = { answers: [{ questionId, userAnswer: '2' }] };
      const payload2 = { answers: [{ questionId, userAnswer: '3' }] };

      const p1 = fetch(`${url}/exams/${examId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload1)
      });
      const p2 = fetch(`${url}/exams/${examId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload2)
      });

      // Give the server time to start Phase 2 (AI call) on the winning request
      await new Promise(r => setTimeout(r, 500));

      // Release AI so the winning request finishes cleanly
      resolveAi({
        strengthAnalysis: { topics: [], description: 'OK' },
        weaknessAnalysis: { topics: [], weakTopics: [], description: 'OK' },
        studyPlan: { steps: [], recommendations: [] },
        perQuestionFeedback: []
      });

      const res1 = await p1;
      const res2 = await p2;

      const statuses = [res1.status, res2.status].sort();
      // One succeeds (201/200), one conflicts (409)
      expect(statuses).toEqual([201, 409]);

      // Assert DB state
      const [dbExam] = await db.select().from(exams).where(eq(exams.id, examId));
      expect(dbExam.evaluationVersion).toBe(1); // Incremented exactly once
      
      const [dbQ] = await db.select().from(questions).where(eq(questions.examId, examId));
      // Whichever request won, its answer is persisted. The losing request's answer is NOT persisted.
      const winningAnswer = res1.status === 201 ? '2' : '3';
      expect(dbQ.userAnswer).toBe(winningAnswer);
    });

    it('exactly 1 of 10 simultaneous requests acquires ownership', async () => {
      const { examId, questionId } = await createExam();
      const url = await app.getUrl();
      
      const promises = Array.from({ length: 10 }).map((_, i) => {
        return fetch(`${url}/exams/${examId}/submit`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: [{ questionId, userAnswer: `${i}` }] })
        });
      });

      // Give the server time to hit the AI mock for the winner
      await new Promise(r => setTimeout(r, 500));

      resolveAi({
        strengthAnalysis: { topics: [], description: 'OK' },
        weaknessAnalysis: { topics: [], weakTopics: [], description: 'OK' },
        studyPlan: { steps: [], recommendations: [] },
        perQuestionFeedback: []
      });

      const responses = await Promise.all(promises);
      const statuses = responses.map(r => r.status).sort();
      
      const successes = statuses.filter(s => s === 201);
      const conflicts = statuses.filter(s => s === 409);
      
      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(9);

      const [dbExam] = await db.select().from(exams).where(eq(exams.id, examId));
      expect(dbExam.evaluationVersion).toBe(1);
    });
  });

  describe('Part 5: Failed Claim Preserves Answers', () => {
    it('answers remain untouched if claim fails due to active lock', async () => {
      const { examId, questionId } = await createExam();
      const url = await app.getUrl();
      
      // Request 1 takes the lock and hangs in AI phase
      const p1 = fetch(`${url}/exams/${examId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: [{ questionId, userAnswer: 'first-answer' }] })
      });

      // Wait a tiny bit to ensure Phase 1 committed
      await new Promise(r => setTimeout(r, 250));

      // Request 2 attempts to claim and should fail
      const res2 = await fetch(`${url}/exams/${examId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: [{ questionId, userAnswer: 'second-answer' }] })
      });
      expect(res2.status).toBe(409);

      // Verify answers are strictly from request 1
      const [dbQ] = await db.select().from(questions).where(eq(questions.examId, examId));
      expect(dbQ.userAnswer).toBe('first-answer');

      // Resolve AI and finish
      resolveAi({});
      await p1;
    });
  });

  describe('Part 6 & 7: Stale Worker Fencing', () => {
    it('fencing gate prevents stale worker from completing exam or unlocking new lock', async () => {
      const { examId, questionId } = await createExam();
      const url = await app.getUrl();
      
      // 1. Worker A starts and holds version 1
      const pA = fetch(`${url}/exams/${examId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: [{ questionId, userAnswer: 'A' }] })
      });

      await new Promise(r => setTimeout(r, 250));

      // 2. Simulate Worker B reclaiming due to stale lock
      // We manually mutate the DB to simulate B's Phase 1
      const newerLockTime = new Date();
      await db.update(exams)
        .set({ evaluationVersion: 2, evaluationLockedAt: newerLockTime })
        .where(eq(exams.id, examId));

      // 3. Resolve AI for Worker A. It will attempt Phase 3 with claimedVersion=1.
      resolveAi({});
      
      const resA = await pA;
      // Worker A throws ConflictException from Phase 3 gate
      expect(resA.status).toBe(409);

      // 4. Assert Worker A was fenced out entirely
      const [dbExam] = await db.select().from(exams).where(eq(exams.id, examId));
      expect(dbExam.status).toBe('active'); // A didn't complete it
      expect(dbExam.evaluationVersion).toBe(2); // Still B's version
      expect(dbExam.evaluationLockedAt?.getTime()).toBe(newerLockTime.getTime()); // B's lock wasn't cleared by A!
    });
  });

  describe('Part 8: Direct Transaction Semantics', () => {
    it('throw ConflictException inside db.transaction causes rollback and propagates ConflictException', async () => {
      const { examId } = await createExam();
      
      try {
        await db.transaction(async (tx) => {
          // Attempt an update
          await tx.update(exams).set({ status: 'completed' }).where(eq(exams.id, examId));
          
          // Throw application exception
          throw new ConflictException('Test rollback');
        });
        fail('Should have thrown');
      } catch (err: any) {
        // Assert propagation
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.message).toBe('Test rollback');
      }
      
      // Assert rollback
      const [dbExam] = await db.select().from(exams).where(eq(exams.id, examId));
      expect(dbExam.status).toBe('active'); // Not completed
    });
  });
});
