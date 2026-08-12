import React, { Suspense } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ExamPage from '../src/app/(dashboard)/exams/[id]/page';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('../src/lib/api-client', () => ({
  api: {
    get: (...args: unknown[]) => mocks.apiGet(...args),
    post: (...args: unknown[]) => mocks.apiPost(...args),
  },
}));

vi.mock('../src/hooks/use-locale', () => ({
  useLocale: () => ({
    locale: 'en',
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        'exams.adaptiveMode': 'Adaptive Mode',
        'exams.completed': 'Completed',
        'exams.completedOn': 'Completed on: {date}',
        'exams.detailedReview': 'Detailed Question Review',
        'exams.excellent': 'Excellent',
        'exams.explanation': 'Explanation:',
        'exams.generateAdaptive': 'Generate Next Adaptive Question',
        'exams.mcqShort': 'MCQ',
        'exams.overallResult': 'Overall Result',
        'exams.performance': 'AI Performance Diagnostics',
        'exams.questionWithType': 'Question {number} ({type})',
        'exams.questions': '{count} questions',
        'exams.studyPath': 'Suggested Study Path',
        'exams.strengths': 'Strengths',
        'exams.tutorFeedback': 'AI Tutor Feedback:',
        'exams.trueFalseShort': 'T/F',
        'exams.weaknesses': 'Weaknesses',
      };

      return (translations[key] ?? key).replace(
        /\{(\w+)\}/g,
        (placeholder, name: string) =>
          params && Object.prototype.hasOwnProperty.call(params, name)
            ? String(params[name])
            : placeholder,
      );
    },
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const completedExam = {
  adaptiveMode: true,
  completedAt: '2026-08-12T08:00:00.000Z',
  difficulty: 'medium',
  fileId: 'file-1',
  id: 'exam-1',
  questions: [
    {
      aiFeedback: 'The retained feedback remains visible.',
      correctAnswer: 'Alpha',
      explanation: 'The retained explanation remains visible.',
      id: 'question-answered',
      isCorrect: true,
      options: ['Alpha', 'Beta'],
      questionText: 'Answered review question',
      type: 'mcq',
      userAnswer: 'Alpha',
    },
    {
      aiFeedback: undefined,
      correctAnswer: 'True',
      explanation: null,
      id: 'question-unanswered',
      isCorrect: false,
      options: ['True', 'False'],
      questionText: 'Unanswered review question',
      type: 'true_false',
      userAnswer: null,
    },
  ],
  score: '86.00',
  status: 'completed',
  strengthAnalysis: {
    description: 'The retained strength summary remains visible.',
    topics: ['Foundations'],
  },
  studyPlan: {
    steps: ['The retained study step remains visible.'],
  },
  title: 'Containment fixture',
  totalQuestions: 2,
  weaknessAnalysis: {
    description: 'The retained weakness summary remains visible.',
    topics: ['Follow-up topic'],
    weakTopics: ['Follow-up topic'],
  },
};

async function renderCompletedExam(exam = completedExam) {
  const params = Object.assign(Promise.resolve({ id: exam.id }), {
    status: 'fulfilled',
    value: { id: exam.id },
  });
  mocks.apiGet.mockResolvedValue(exam);

  render(
    <Suspense fallback={<div>Loading fixture</div>}>
      <ExamPage params={params} />
    </Suspense>,
  );

  await screen.findByText(exam.title);
}

describe('completed exam result containment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the normal completed-answer review and supporting result information', async () => {
    await renderCompletedExam({
      ...completedExam,
      questions: [completedExam.questions[0]],
      totalQuestions: 1,
      weaknessAnalysis: undefined,
    });

    expect(screen.getByText('86.00%')).not.toBeNull();
    expect(screen.getByText('Answered review question')).not.toBeNull();
    expect(screen.getByText('Alpha')).not.toBeNull();
    expect(
      screen.getByText('The retained explanation remains visible.'),
    ).not.toBeNull();
    expect(
      screen.getByText('The retained feedback remains visible.'),
    ).not.toBeNull();
  });

  it('renders a null-answer completed review without exposing adaptive generation', async () => {
    await renderCompletedExam();

    expect(screen.getByText('86.00%')).not.toBeNull();
    expect(screen.getByText('Answered review question')).not.toBeNull();
    expect(
      screen
        .getByText('Unanswered review question')
        .closest('[data-answer-state]')
        ?.getAttribute('data-answer-state'),
    ).toBe('unanswered');
    expect(
      screen.getByText('The retained study step remains visible.'),
    ).not.toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'Generate Next Adaptive Question',
      }),
    ).toBeNull();
    expect(mocks.apiPost).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('undefined');
  });
});
