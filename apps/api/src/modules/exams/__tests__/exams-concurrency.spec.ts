import { Test, TestingModule } from '@nestjs/testing';

const requiredTestEnvironment = ['STRIPE_SECRET_KEY', 'JWT_SECRET', 'DATABASE_URL'] as const;

for (const variableName of requiredTestEnvironment) {
  if (!process.env[variableName]) {
    throw new Error(`${variableName} must be supplied through the environment.`);
  }
}

import { INestApplication, ValidationPipe, ConflictException } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { db, users, files, exams, questions, eq } from '@studyai/database';
import { JwtService } from '@nestjs/jwt';
import { AiService } from '../../ai/ai.service';
import { GamificationService } from '../../study-coach/gamification.service';
import {
  INVALID_RELEASE_EXAM_MESSAGE,
  RELEASE_QUESTION_TYPE_MESSAGE,
} from '../exam-release-eligibility';
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
  let aiStarted: Promise<void> = Promise.resolve();
  let signalAiStarted: () => void = () => {};
  let generateExamFeedback: jest.Mock;
  const updateChallengeProgress = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    generateExamFeedback = jest.fn().mockImplementation(() => {
      const pendingAi = new Promise((resolve) => {
        resolveAi = resolve;
      });
      signalAiStarted();
      return pendingAi;
    });
    const mockAiService = {
      generateExamFeedback,
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
      .overrideProvider(GamificationService)
      .useValue({ updateChallengeProgress })
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
      lastName: 'Concurrency',
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

  type SeedQuestion = {
    type: 'mcq' | 'true_false' | 'fill_blank' | 'essay' | 'short';
    questionText?: string;
    options?: string[] | null;
    correctAnswer?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    points?: number;
  };

  const createExamWithQuestions = async (seedQuestions: SeedQuestion[]) => {
    const examId = uuidv4();
    await db.insert(exams).values({
      id: examId,
      fileId,
      userId: testUserId,
      title: 'Release Contract Test Exam',
      difficulty: 'medium',
      totalQuestions: seedQuestions.length,
      status: 'active',
      evaluationVersion: 0,
    });

    const insertedQuestions: Array<{ id: string }> = [];
    for (const [index, seed] of seedQuestions.entries()) {
      const questionId = uuidv4();
      await db.insert(questions).values({
        id: questionId,
        examId,
        type: seed.type,
        questionText: seed.questionText ?? `Question ${index + 1}`,
        options: seed.options === undefined ? ['Alpha', 'Beta'] : seed.options,
        correctAnswer: seed.correctAnswer ?? 'Alpha',
        difficulty: seed.difficulty ?? 'medium',
        orderIndex: index,
        points: seed.points ?? 1,
      });
      insertedQuestions.push({ id: questionId });
    }

    return { examId, insertedQuestions };
  };

  const expectReleaseRejectionWithoutMutation = async (
    seedQuestions: SeedQuestion[],
    expectedMessage: string,
  ) => {
    const { examId, insertedQuestions } = await createExamWithQuestions(seedQuestions);
    const url = await app.getUrl();
    const answers = insertedQuestions.map(({ id }) => ({
      questionId: id,
      userAnswer: 'attempted answer',
    }));

    const response = await fetch(`${url}/exams/${examId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ message: expectedMessage });

    const [storedExam] = await db.select().from(exams).where(eq(exams.id, examId));
    expect(storedExam).toMatchObject({
      status: 'active',
      score: null,
      evaluationLockedAt: null,
      evaluationVersion: 0,
    });

    const storedQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.examId, examId));
    for (const storedQuestion of storedQuestions) {
      expect(storedQuestion.userAnswer).toBeNull();
      expect(storedQuestion.isCorrect).toBeNull();
      expect(storedQuestion.answeredAt).toBeNull();
    }

    const listResponse = await fetch(`${url}/exams`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listResponse.status).toBe(200);
    const examList = (await listResponse.json()) as Array<{
      id: string;
      attemptEligible: boolean;
    }>;
    expect(examList.find((exam) => exam.id === examId)?.attemptEligible).toBe(false);
    expect(generateExamFeedback).not.toHaveBeenCalled();
    expect(updateChallengeProgress).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    generateExamFeedback.mockClear();
    updateChallengeProgress.mockClear();
    resolveAi = () => {};
    aiStarted = new Promise(resolve => {
      signalAiStarted = resolve;
    });
  });

  describe('Release question-type containment', () => {
    it.each([
      ['true_false', RELEASE_QUESTION_TYPE_MESSAGE],
      ['fill_blank', RELEASE_QUESTION_TYPE_MESSAGE],
      ['essay', RELEASE_QUESTION_TYPE_MESSAGE],
      ['short', RELEASE_QUESTION_TYPE_MESSAGE],
    ] as const)(
      'rejects a direct %s submission before any authoritative mutation',
      async (type, expectedMessage) => {
        await expectReleaseRejectionWithoutMutation(
          [{ type, options: type === 'true_false' ? ['true', 'false'] : null }],
          expectedMessage,
        );
      },
    );

    it('rejects a direct mixed-format submission before any authoritative mutation', async () => {
      await expectReleaseRejectionWithoutMutation(
        [
          { type: 'mcq' },
          { type: 'true_false', options: ['true', 'false'], correctAnswer: 'true' },
        ],
        RELEASE_QUESTION_TYPE_MESSAGE,
      );
    });

    it('rejects a direct empty-exam submission before any authoritative mutation', async () => {
      await expectReleaseRejectionWithoutMutation([], INVALID_RELEASE_EXAM_MESSAGE);
    });

    it.each([
      { seedQuestions: [{ type: 'mcq', questionText: '   ' }] },
      { seedQuestions: [{ type: 'mcq', options: ['Same', ' same '] }] },
      { seedQuestions: [{ type: 'mcq', correctAnswer: 'Missing' }] },
      { seedQuestions: [{ type: 'mcq', points: 0 }] },
    ] as Array<{ seedQuestions: SeedQuestion[] }>)(
      'rejects malformed persisted MCQ state before any authoritative mutation',
      async ({ seedQuestions }) => {
        await expectReleaseRejectionWithoutMutation(
          seedQuestions,
          INVALID_RELEASE_EXAM_MESSAGE,
        );
      },
    );

    it('preserves the valid active MCQ submit and completed-result path', async () => {
      const { examId, questionId } = await createExam();
      const url = await app.getUrl();
      const listResponse = await fetch(`${url}/exams`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(listResponse.status).toBe(200);
      const examList = (await listResponse.json()) as Array<{
        id: string;
        attemptEligible: boolean;
      }>;
      expect(examList.find((exam) => exam.id === examId)?.attemptEligible).toBe(true);

      const submitPromise = fetch(`${url}/exams/${examId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: [{ questionId, userAnswer: '2' }],
        }),
      });

      await aiStarted;
      resolveAi({
        strengthAnalysis: { topics: [], description: 'OK' },
        weaknessAnalysis: { topics: [], weakTopics: [], description: 'OK' },
        studyPlan: { steps: [], recommendations: [] },
        perQuestionFeedback: [],
      });

      const submitResponse = await submitPromise;
      expect(submitResponse.status).toBe(201);
      expect(await submitResponse.json()).toMatchObject({
        id: examId,
        status: 'completed',
        attemptEligible: false,
      });

      const resultResponse = await fetch(`${url}/exams/${examId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resultResponse.status).toBe(200);
      expect(await resultResponse.json()).toMatchObject({
        id: examId,
        status: 'completed',
        questions: [
          expect.objectContaining({
            id: questionId,
            userAnswer: '2',
            isCorrect: true,
          }),
        ],
      });
    });
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
        body: JSON.stringify(payload1),
      });
      const p2 = fetch(`${url}/exams/${examId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload2),
      });

      // Wait until the winning request has entered Phase 2 (AI call).
      await aiStarted;

      // Release AI so the winning request finishes cleanly
      resolveAi({
        strengthAnalysis: { topics: [], description: 'OK' },
        weaknessAnalysis: { topics: [], weakTopics: [], description: 'OK' },
        studyPlan: { steps: [], recommendations: [] },
        perQuestionFeedback: [],
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
          body: JSON.stringify({ answers: [{ questionId, userAnswer: `${i}` }] }),
        });
      });

      // Wait until the winning request has entered Phase 2 (AI call).
      await aiStarted;

      resolveAi({
        strengthAnalysis: { topics: [], description: 'OK' },
        weaknessAnalysis: { topics: [], weakTopics: [], description: 'OK' },
        studyPlan: { steps: [], recommendations: [] },
        perQuestionFeedback: [],
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
        body: JSON.stringify({ answers: [{ questionId, userAnswer: 'first-answer' }] }),
      });

      // The AI call begins only after Phase 1 has committed.
      await aiStarted;

      // Request 2 attempts to claim and should fail
      const res2 = await fetch(`${url}/exams/${examId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: [{ questionId, userAnswer: 'second-answer' }] }),
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
        body: JSON.stringify({ answers: [{ questionId, userAnswer: 'A' }] }),
      });

      // The AI call begins only after Worker A has committed Phase 1.
      await aiStarted;

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
