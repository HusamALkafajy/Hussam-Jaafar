import { Difficulty } from '@studyai/types';
import {
  evaluateReleaseAttemptEligibility,
  isGeneratedReleaseMcqQuestion,
} from './exam-release-eligibility';

const validQuestion = {
  id: '00000000-0000-4000-8000-000000000001',
  type: 'mcq',
  questionText: 'Which answer is correct?',
  options: ['Alpha', 'Beta'],
  correctAnswer: 'Alpha',
  difficulty: 'medium',
  points: 1,
};

describe('release attempt eligibility', () => {
  it('accepts only a non-empty active batch of structurally valid MCQs', () => {
    expect(
      evaluateReleaseAttemptEligibility({ status: 'active', questions: [validQuestion] }),
    ).toEqual({ eligible: true });
  });

  it.each(['true_false', 'fill_blank', 'essay', 'short', 'unknown'])(
    'rejects the unsupported or unknown question type %s',
    (type) => {
      expect(
        evaluateReleaseAttemptEligibility({
          status: 'active',
          questions: [{ ...validQuestion, type }],
        }),
      ).toEqual({ eligible: false, reason: 'UNSUPPORTED_QUESTION_TYPE' });
    },
  );

  it('rejects a mixed MCQ and unsupported batch', () => {
    expect(
      evaluateReleaseAttemptEligibility({
        status: 'active',
        questions: [validQuestion, { ...validQuestion, type: 'true_false' }],
      }),
    ).toEqual({ eligible: false, reason: 'UNSUPPORTED_QUESTION_TYPE' });
  });

  it.each(['draft', 'completed', 'unknown', '', null])(
    'rejects the invalid attempt status %p',
    (status) => {
      expect(
        evaluateReleaseAttemptEligibility({ status, questions: [validQuestion] }),
      ).toEqual({ eligible: false, reason: 'INVALID_STATUS' });
    },
  );

  it('rejects empty and missing question collections', () => {
    expect(evaluateReleaseAttemptEligibility({ status: 'active', questions: [] })).toEqual({
      eligible: false,
      reason: 'EMPTY_QUESTIONS',
    });
    expect(evaluateReleaseAttemptEligibility({ status: 'active' })).toEqual({
      eligible: false,
      reason: 'EMPTY_QUESTIONS',
    });
  });

  it.each([
    ['empty question text', { ...validQuestion, questionText: '  ' }],
    ['missing options', { ...validQuestion, options: undefined }],
    ['fewer than two options', { ...validQuestion, options: ['Alpha'] }],
    ['empty option', { ...validQuestion, options: ['Alpha', '  '] }],
    ['normalized duplicates', { ...validQuestion, options: ['Ａlpha', 'alpha'] }],
    ['answer outside options', { ...validQuestion, correctAnswer: 'Gamma' }],
    ['missing difficulty', { ...validQuestion, difficulty: undefined }],
    ['mixed difficulty', { ...validQuestion, difficulty: 'mixed' }],
    ['missing points', { ...validQuestion, points: undefined }],
    ['null points', { ...validQuestion, points: null }],
    ['NaN points', { ...validQuestion, points: Number.NaN }],
    ['infinite points', { ...validQuestion, points: Number.POSITIVE_INFINITY }],
    ['zero points', { ...validQuestion, points: 0 }],
    ['negative points', { ...validQuestion, points: -1 }],
    ['fractional points', { ...validQuestion, points: 1.5 }],
    ['string points', { ...validQuestion, points: '1' }],
    ['boolean points', { ...validQuestion, points: true }],
    ['object points', { ...validQuestion, points: {} }],
  ])('rejects a persisted MCQ with %s', (_label, question) => {
    expect(
      evaluateReleaseAttemptEligibility({ status: 'active', questions: [question] }),
    ).toEqual({ eligible: false, reason: 'MALFORMED_MCQ' });
  });

  it('matches answers after deterministic Unicode, whitespace, and case normalization', () => {
    expect(
      evaluateReleaseAttemptEligibility({
        status: 'active',
        questions: [
          {
            ...validQuestion,
            options: ['  ALPHA  ', 'Beta'],
            correctAnswer: 'alpha',
          },
        ],
      }),
    ).toEqual({ eligible: true });
  });

  it('allows generated defaults only where creation supplies persisted defaults', () => {
    const generatedQuestion = {
      type: 'mcq',
      questionText: 'Generated question',
      options: ['Alpha', 'Beta'],
      correctAnswer: 'Alpha',
    };

    expect(isGeneratedReleaseMcqQuestion(generatedQuestion, Difficulty.MEDIUM)).toBe(true);
    expect(isGeneratedReleaseMcqQuestion(generatedQuestion, Difficulty.MIXED)).toBe(false);
  });
});
