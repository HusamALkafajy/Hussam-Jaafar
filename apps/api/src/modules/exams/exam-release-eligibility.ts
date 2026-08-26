import { Difficulty, QuestionType } from '@studyai/types';

export const RELEASE_QUESTION_TYPE_MESSAGE =
  'Only multiple-choice exam questions are supported for the current release.';

export const INVALID_RELEASE_EXAM_MESSAGE =
  'This exam contains invalid multiple-choice questions and cannot be submitted.';

export type ReleaseAttemptIneligibilityReason =
  | 'INVALID_STATUS'
  | 'EMPTY_QUESTIONS'
  | 'UNSUPPORTED_QUESTION_TYPE'
  | 'MALFORMED_MCQ';

export type ReleaseAttemptEligibility =
  | { eligible: true }
  | { eligible: false; reason: ReleaseAttemptIneligibilityReason };

type QuestionValidationOptions = {
  allowMissingDifficulty: boolean;
  allowMissingPoints: boolean;
  validateExplanation: boolean;
};

const normalizeOption = (value: string): string =>
  value.trim().normalize('NFKC').toLowerCase();

const isSupportedDifficulty = (value: unknown): boolean =>
  value === Difficulty.EASY || value === Difficulty.MEDIUM || value === Difficulty.HARD;

function validateReleaseMcqQuestion(
  candidate: unknown,
  options: QuestionValidationOptions,
): ReleaseAttemptIneligibilityReason | null {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return 'MALFORMED_MCQ';
  }

  const question = candidate as Record<string, unknown>;
  if (question.type !== QuestionType.MCQ) {
    return 'UNSUPPORTED_QUESTION_TYPE';
  }

  if (
    typeof question.questionText !== 'string' ||
    question.questionText.trim().length === 0 ||
    !Array.isArray(question.options) ||
    question.options.length < 2 ||
    question.options.some(
      (option) => typeof option !== 'string' || option.trim().length === 0,
    ) ||
    typeof question.correctAnswer !== 'string' ||
    question.correctAnswer.trim().length === 0
  ) {
    return 'MALFORMED_MCQ';
  }

  const normalizedOptions = question.options.map((option) =>
    normalizeOption(option as string),
  );
  if (new Set(normalizedOptions).size !== normalizedOptions.length) {
    return 'MALFORMED_MCQ';
  }

  const normalizedCorrectAnswer = normalizeOption(question.correctAnswer);
  if (normalizedOptions.filter((option) => option === normalizedCorrectAnswer).length !== 1) {
    return 'MALFORMED_MCQ';
  }

  if (
    question.difficulty === undefined
      ? !options.allowMissingDifficulty
      : !isSupportedDifficulty(question.difficulty)
  ) {
    return 'MALFORMED_MCQ';
  }

  if (
    question.points === undefined || question.points === null
      ? !options.allowMissingPoints
      : !Number.isInteger(question.points) || (question.points as number) <= 0
  ) {
    return 'MALFORMED_MCQ';
  }

  if (
    options.validateExplanation &&
    question.explanation !== undefined &&
    question.explanation !== null &&
    typeof question.explanation !== 'string'
  ) {
    return 'MALFORMED_MCQ';
  }

  return null;
}

export function isGeneratedReleaseMcqQuestion(
  candidate: unknown,
  dtoDifficulty: Difficulty,
): boolean {
  return (
    validateReleaseMcqQuestion(candidate, {
      allowMissingDifficulty: dtoDifficulty !== Difficulty.MIXED,
      allowMissingPoints: true,
      validateExplanation: true,
    }) === null
  );
}

export function evaluateReleaseAttemptEligibility(candidate: unknown): ReleaseAttemptEligibility {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { eligible: false, reason: 'INVALID_STATUS' };
  }

  const exam = candidate as Record<string, unknown>;
  if (exam.status !== 'active') {
    return { eligible: false, reason: 'INVALID_STATUS' };
  }

  if (!Array.isArray(exam.questions) || exam.questions.length === 0) {
    return { eligible: false, reason: 'EMPTY_QUESTIONS' };
  }

  for (const question of exam.questions) {
    const reason = validateReleaseMcqQuestion(question, {
      allowMissingDifficulty: false,
      allowMissingPoints: false,
      validateExplanation: false,
    });
    if (reason) {
      return { eligible: false, reason };
    }
  }

  return { eligible: true };
}
