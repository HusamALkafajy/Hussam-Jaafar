import React, { Suspense } from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ExamPage from '../src/app/(dashboard)/exams/[id]/page';
import ExamsPage from '../src/app/(dashboard)/exams/page';

const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('../src/lib/api-client', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));

vi.mock('../src/hooks/use-locale', () => ({
  useLocale: () => {
    const translations: Record<string, string> = {
      'common.back': 'Back',
      'common.error': 'Error',
      'common.loading': 'Loading',
      'exams.backToExams': 'Back to quizzes',
      'exams.completed': 'Completed',
      'exams.completedOn': 'Completed on {date}',
      'exams.correctAnswer': 'Correct answer',
      'exams.difficulty': 'Difficulty: {level}',
      'exams.draft': 'Draft',
      'exams.draftUnavailableAction': 'Not available yet',
      'exams.draftUnavailableMessage': 'This quiz is not available to start yet.',
      'exams.draftUnavailableTitle': 'Quiz not ready',
      'exams.inProgress': 'In progress',
      'exams.noExams': 'No quizzes',
      'exams.questionProgress': 'Question {current} of {total}',
      'exams.questions': '{count} questions',
      'exams.score': 'Score: {score}%',
      'exams.start': 'Start quiz',
      'exams.submit': 'Submit quiz',
      'exams.submitHint': 'You must answer every question before submission.',
      'exams.title': 'Quizzes',
      'exams.unsupportedFormatMessage':
        'This quiz uses a question format that is not available in the current release.',
      'exams.unsupportedFormatTitle': 'Quiz format unavailable',
      'exams.viewResults': 'View results',
    };

    return {
      locale: 'en',
      t: (key: string, params?: Record<string, string | number>) => {
        let value = translations[key] ?? key;
        for (const [name, replacement] of Object.entries(params ?? {})) {
          value = value.replace(`{${name}}`, String(replacement));
        }
        return value;
      },
    };
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

const mcqQuestion = {
  id: 'question-1',
  type: 'mcq',
  questionText: 'Which answer is correct?',
  options: ['Alpha', 'Beta'],
  correctAnswer: 'Alpha',
  explanation: null,
  difficulty: 'medium',
  points: 1,
};

const activeExam = {
  id: 'exam-active',
  fileId: 'file-1',
  title: 'Active MCQ quiz',
  difficulty: 'medium',
  totalQuestions: 1,
  status: 'active',
  attemptEligible: true,
  timeLimitMinutes: 1,
  createdAt: '2026-08-14T00:00:00.000Z',
  questions: [mcqQuestion],
};

function renderExam(exam: Record<string, unknown>) {
  const params = Object.assign(Promise.resolve({ id: String(exam.id) }), {
    status: 'fulfilled',
    value: { id: String(exam.id) },
  });
  apiGet.mockResolvedValueOnce(exam);
  render(
    <Suspense fallback={<div>Loading</div>}>
      <ExamPage params={params} />
    </Suspense>,
  );
}

describe('exam question-type release containment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('keeps the active MCQ answer and submit path available', async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValueOnce({
      ...activeExam,
      status: 'completed',
      completedAt: '2026-08-14T00:01:00.000Z',
      score: '100.00',
      strengthAnalysis: null,
      weaknessAnalysis: null,
      studyPlan: null,
      questions: [{ ...mcqQuestion, userAnswer: 'Alpha', isCorrect: true }],
    });

    renderExam(activeExam);

    await screen.findByText('Active MCQ quiz');
    await user.click(screen.getByRole('button', { name: 'Alpha' }));
    await user.click(screen.getByRole('button', { name: 'Submit quiz' }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/exams/exam-active/submit', {
        answers: [{ questionId: 'question-1', userAnswer: 'Alpha' }],
      });
    });
  });

  it.each(['true_false', 'fill_blank', 'essay', 'short', 'unknown'])(
    'blocks an active %s question before rendering unsafe controls',
    async (type) => {
      renderExam({
        ...activeExam,
        id: `exam-${type}`,
        title: `${type} quiz`,
        attemptEligible: false,
        questions: [{ ...mcqQuestion, type }],
      });

      expect(await screen.findByText('Quiz format unavailable')).toBeTruthy();
      expect(
        screen.getByText(
          'This quiz uses a question format that is not available in the current release.',
        ),
      ).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Submit quiz' })).toBeNull();
      expect(apiPost).not.toHaveBeenCalled();
    },
  );

  it('blocks malformed MCQ questions without a valid option contract', async () => {
    renderExam({
      ...activeExam,
      id: 'exam-malformed-mcq',
      title: 'Malformed MCQ quiz',
      attemptEligible: false,
      questions: [{ ...mcqQuestion, options: ['Same', ' same '] }],
    });

    expect(await screen.findByText('Quiz format unavailable')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit quiz' })).toBeNull();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('blocks active exams that have no questions', async () => {
    renderExam({
      ...activeExam,
      id: 'exam-empty',
      title: 'Empty quiz',
      attemptEligible: false,
      questions: [],
    });

    expect(await screen.findByText('Quiz format unavailable')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit quiz' })).toBeNull();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('keeps draft exams unavailable and does not start a timer or submit automatically', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderExam({
      ...activeExam,
      id: 'exam-draft',
      title: 'Draft quiz',
      status: 'draft',
      attemptEligible: false,
    });

    expect(await screen.findByText('Quiz not ready')).toBeTruthy();
    expect(screen.getByText('This quiz is not available to start yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit quiz' })).toBeNull();
    expect(screen.queryByText('1:00')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(apiPost).not.toHaveBeenCalled();
  });

  it('exposes actions only for eligible active and completed cards in the general list', async () => {
    apiGet.mockResolvedValueOnce([
      { ...activeExam, id: 'exam-list-active', title: 'List active quiz' },
      {
        ...activeExam,
        id: 'exam-list-completed',
        title: 'List completed quiz',
        status: 'completed',
        score: '80.00',
      },
      {
        ...activeExam,
        id: 'exam-list-draft',
        title: 'List draft quiz',
        status: 'draft',
        attemptEligible: false,
      },
      {
        ...activeExam,
        id: 'exam-list-unsupported',
        title: 'List unsupported quiz',
        attemptEligible: false,
      },
      {
        ...activeExam,
        id: 'exam-list-mixed',
        title: 'List mixed quiz',
        attemptEligible: false,
      },
      {
        ...activeExam,
        id: 'exam-list-unknown',
        title: 'List unknown quiz',
        attemptEligible: false,
      },
      {
        ...activeExam,
        id: 'exam-list-malformed',
        title: 'List malformed quiz',
        attemptEligible: false,
      },
      {
        ...activeExam,
        id: 'exam-list-invalid-status',
        title: 'List invalid-status quiz',
        status: 'archived',
        attemptEligible: false,
      },
    ]);

    render(<ExamsPage />);

    const activeTitle = await screen.findByText('List active quiz');
    const completedTitle = screen.getByText('List completed quiz');
    const draftTitle = screen.getByText('List draft quiz');
    const activeCard = activeTitle.closest('[data-slot="card"]');
    const completedCard = completedTitle.closest('[data-slot="card"]');
    const draftCard = draftTitle.closest('[data-slot="card"]');

    expect(activeCard).not.toBeNull();
    expect(completedCard).not.toBeNull();
    expect(draftCard).not.toBeNull();
    expect(within(activeCard!).getByRole('button', { name: 'Start quiz' }).getAttribute('href')).toBe(
      '/exams/exam-list-active',
    );
    expect(
      within(completedCard!).getByRole('button', { name: 'View results' }).getAttribute('href'),
    ).toBe('/exams/exam-list-completed');
    expect(within(draftCard!).getByText('Draft')).toBeTruthy();
    expect(within(draftCard!).getByText('Not available yet')).toBeTruthy();
    expect(draftCard!.querySelector('a')).toBeNull();

    for (const title of [
      'List unsupported quiz',
      'List mixed quiz',
      'List unknown quiz',
      'List malformed quiz',
      'List invalid-status quiz',
    ]) {
      const blockedCard = screen.getByText(title).closest('[data-slot="card"]');
      expect(blockedCard).not.toBeNull();
      expect(within(blockedCard!).getByText('Not available yet')).toBeTruthy();
      expect(blockedCard!.querySelector('a')).toBeNull();
    }
  });

  it.each([
    ['unsupported', [{ ...mcqQuestion, type: 'true_false' }]],
    ['mixed', [mcqQuestion, { ...mcqQuestion, id: 'question-2', type: 'fill_blank' }]],
    ['unknown', [{ ...mcqQuestion, type: 'unknown' }]],
    ['malformed', [{ ...mcqQuestion, options: ['Same', ' same '] }]],
  ])(
    'does not start a timer or submit an active %s exam rejected by the server contract',
    async (label, examQuestions) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      renderExam({
        ...activeExam,
        id: `exam-timer-${label}`,
        title: `${label} timer quiz`,
        attemptEligible: false,
        questions: examQuestions,
      });

      expect(await screen.findByText('Quiz format unavailable')).toBeTruthy();
      expect(screen.queryByText('1:00')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(120_000);
      });
      expect(apiPost).not.toHaveBeenCalled();
    },
  );
});
