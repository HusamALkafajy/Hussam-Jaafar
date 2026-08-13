'use client';

import React, { useEffect, useState, use } from 'react';
import { api } from '../../../../lib/api-client';
import { useLocale } from '../../../../hooks/use-locale';
import { Card } from '../../../../components/ui/card';
import { Button, buttonVariants } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Spinner } from '../../../../components/ui/spinner';
import { cn } from '../../../../lib/utils';
import {
  GraduationCap,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  FileText,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Brain,
} from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

const normalizeReviewText = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const normalizeReviewKey = (value: unknown): string =>
  normalizeReviewText(value).trim().toLocaleLowerCase();

const normalizeAttemptOption = (value: string): string =>
  value.trim().toLowerCase();

const isReleaseSafeAttempt = (candidate: unknown): boolean => {
  if (!candidate || typeof candidate !== 'object') return false;

  const examCandidate = candidate as Record<string, unknown>;
  if (examCandidate.status !== 'active' || !Array.isArray(examCandidate.questions)) {
    return false;
  }
  if (examCandidate.questions.length === 0) return false;

  return examCandidate.questions.every((questionCandidate) => {
    if (!questionCandidate || typeof questionCandidate !== 'object') return false;

    const question = questionCandidate as Record<string, unknown>;
    if (
      question.type !== 'mcq' ||
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
      return false;
    }

    const normalizedOptions = question.options.map((option) =>
      normalizeAttemptOption(option as string),
    );
    if (new Set(normalizedOptions).size !== normalizedOptions.length) return false;

    const normalizedCorrectAnswer = normalizeAttemptOption(question.correctAnswer);
    return normalizedOptions.filter((option) => option === normalizedCorrectAnswer).length === 1;
  });
};

export default function ExamPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const examId = resolvedParams.id;
  return <ExamSession key={examId} examId={examId} />;
}

function ExamSession({ examId }: { examId: string }) {
  const { t, locale } = useLocale();

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const attemptIsReleaseSafe = isReleaseSafeAttempt(exam);

  useEffect(() => {
    let ignore = false;

    const fetchExam = async () => {
      setLoading(true);
      try {
        const data = await api.get<any>(`/exams/${examId}`);
        if (!ignore) {
          setExam(data);

          // Initialize timer if exam is active and has a time limit
          if (isReleaseSafeAttempt(data) && data.timeLimitMinutes) {
            // Simple mock countdown matching time limit
            setTimeLeft(data.timeLimitMinutes * 60);
          }
        }
      } catch (e) {
        if (!ignore) console.error('Failed to load exam', e);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchExam();

    return () => {
      ignore = true;
    };
  }, [examId]);



  const handleSelectOption = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  // ============================================================================
  // ENGINEERING NOTE: SYNCHRONOUS MUTUAL EXCLUSION
  // ============================================================================
  // Why both `submissionStartedRef` and `submitting` state exist:
  // - `submitting` is for UI feedback (disabling buttons, showing spinners).
  // - `submissionStartedRef` is a synchronous concurrency guard. Since React 
  //   state updates are asynchronous, the ref strictly guarantees that manual 
  //   submission and timer auto-submission cannot enter the submission flow 
  //   in the exact same event loop window.
  // ============================================================================
  const submissionStartedRef = React.useRef(false);

  const handleSubmitExam = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isReleaseSafeAttempt(exam) || submitting || submissionStartedRef.current) return;

    submissionStartedRef.current = true;
    setSubmitting(true);

    // Format answers for API DTO structure
    const formattedAnswers = Object.entries(answers).map(([questionId, userAnswer]) => ({
      questionId,
      userAnswer,
    }));

    // Ensure all questions are answered or pad empty answers
    const payloadAnswers = exam.questions.map((q: any) => {
      const existing = formattedAnswers.find((a) => a.questionId === q.id);
      return {
        questionId: q.id,
        userAnswer: existing ? existing.userAnswer : '',
      };
    });

    try {
      const results = await api.post<any>(`/exams/${examId}/submit`, {
        answers: payloadAnswers,
      });
      setExam(results);
      setTimeLeft(null);
    } catch {
      alert(t('exams.submitFailure'));
      submissionStartedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // ENGINEERING NOTE: LATEST REF PATTERN for TIMER
  // ============================================================================
  // Why this exists: We need to access the freshest `handleSubmitExam` closure 
  // when the timer hits 0, without putting it in the timer's dependency array.
  // Why no useCallback: `answers` changes on every keystroke, which would cause 
  // useCallback to return a new reference, forcing the timer to tear down and 
  // reset on every user interaction (The Timer Trap).
  // Why independent timer: The timer's lifecycle (ticking every 1s) must be 
  // completely decoupled from the React render cycle triggered by user inputs.
  // TODO: Future migration path - extract this pattern into a shared 
  // `useLatest` or `useInterval` hook for standardizing safe timers.
  // ============================================================================
  const latestState = React.useRef({
    attemptIsReleaseSafe,
    handleSubmitExam,
    status: exam?.status,
  });
  useEffect(() => {
    latestState.current = {
      attemptIsReleaseSafe,
      handleSubmitExam,
      status: exam?.status,
    };
  });

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) {
      if (
        timeLeft === 0 &&
        latestState.current.status === 'active' &&
        latestState.current.attemptIsReleaseSafe
      ) {
        latestState.current.handleSubmitExam();
      }
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="text-center py-12 flex flex-col items-center gap-3">
        <p className="text-slate-400">{t('exams.notFound')}</p>
        <Button nativeButton={false} render={<Link href="/exams" />}>
          {t('exams.backToExams')}
        </Button>
      </div>
    );
  }

  const isCompleted = exam.status === 'completed';
  const isDraft = exam.status === 'draft';

  return (
    <div className="flex flex-col gap-6">
      {/* Exam Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/40 pb-6">
        <div className="flex items-start gap-4">
          <Link
            href={isCompleted ? '/exams' : `/files/${exam.fileId}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), "mt-1 rounded-lg border-slate-800 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer")}
          >
            <ArrowRight className="w-4 h-4 rtl-flip" />
          </Link>
          <div className="flex flex-col gap-1.5 min-w-0">
            <h2 className="text-2xl font-bold text-white truncate max-w-[500px]">
              {exam.title}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
              <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-bold uppercase">
                {exam.difficulty}
              </span>
              <span>•</span>
              <span>{t('exams.questions', { count: exam.totalQuestions })}</span>
            </div>
          </div>
        </div>

        {/* Timer or Status badge */}
        {!isCompleted && attemptIsReleaseSafe && timeLeft !== null && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 font-mono text-lg font-bold self-start md:self-center">
            <Clock className="w-5 h-5 animate-pulse" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        )}

        {isCompleted && (
          <Badge variant="success" className="px-4 py-1.5 self-start md:self-center font-bold">
            {t('exams.completed')}
          </Badge>
        )}
      </div>

      {/* Main Body */}
      {isCompleted ? (
        /* ================= RESULTS VIEW ================= */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left panel: Score details and study recommendations */}
          <div className="lg:col-span-1 flex flex-col gap-6 lg:sticky lg:top-24">
            <Card className="p-6 bg-slate-900/20 border-slate-800/60 flex flex-col items-center text-center gap-4 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1.5 gradient-primary" />
              <h3 className="text-base font-bold text-white">
                {t('exams.overallResult')}
              </h3>

              {/* Dynamic circular score gauge */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    className="stroke-slate-800"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    className={Number(exam.score) >= 70 ? 'stroke-emerald-500' : 'stroke-amber-500'}
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 60}
                    strokeDashoffset={2 * Math.PI * 60 * (1 - Number(exam.score) / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-extrabold text-white">{exam.score}%</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                    {Number(exam.score) >= 70 ? t('exams.excellent') : t('exams.needsReview')}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-400 font-medium">
                {t('exams.completedOn', {
                  date: new Date(exam.completedAt).toLocaleDateString(locale),
                })}
              </div>
            </Card>

            {/* AI Strengths/Weaknesses card */}
            {(exam.strengthAnalysis || exam.weaknessAnalysis) && (
              <Card className="p-6 bg-slate-900/20 border-slate-805/60 flex flex-col gap-5">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-indigo-400" />
                  <span>{t('exams.performance')}</span>
                </h4>

                {exam.strengthAnalysis && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-emerald-450 uppercase flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {t('exams.strengths')}
                    </span>
                    {exam.strengthAnalysis.topics?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {exam.strengthAnalysis.topics.map((topic: string, i: number) => (
                          <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-500/15">{topic}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-slate-350 bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg leading-relaxed">
                      {exam.strengthAnalysis.description}
                    </p>
                  </div>
                )}

                {exam.weaknessAnalysis && exam.weaknessAnalysis.topics?.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-amber-500 uppercase flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {t('exams.weaknesses')}
                    </span>
                    {exam.weaknessAnalysis.topics?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {exam.weaknessAnalysis.topics.map((topic: string, i: number) => (
                          <span key={i} className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-bold border border-amber-500/15">{topic}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-slate-355 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg leading-relaxed">
                      {exam.weaknessAnalysis.description}
                    </p>
                  </div>
                )}
              </Card>
            )}

            {/* AI Recommendation plan */}
            {exam.studyPlan && (
              <Card className="p-6 bg-indigo-950/10 border-indigo-500/10 flex flex-col gap-4">
                <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <GraduationCap className="w-4.5 h-4.5" />
                  <span>{t('exams.studyPath')}</span>
                </h4>
                <ul className="flex flex-col gap-2.5">
                  {exam.studyPlan.steps.map((step: string, idx: number) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                      <span className="w-4 h-4 bg-indigo-500/20 text-indigo-400 font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {/* Right panel: Questions review */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <h3 className="text-lg font-bold text-white">
              {t('exams.detailedReview')}
            </h3>
            {exam.questions.map((q: any, idx: number) => {
              const userAnswer = normalizeReviewText(q.userAnswer);
              const userAnswerKey = normalizeReviewKey(userAnswer);
              const correctAnswerKey = normalizeReviewKey(q.correctAnswer);
              const options = Array.isArray(q.options)
                ? q.options
                    .map((option: unknown) => normalizeReviewText(option))
                    .filter((option: string) => option.trim().length > 0)
                : [];
              const explanation = normalizeReviewText(q.explanation);
              const aiFeedback = normalizeReviewText(q.aiFeedback);
              const isUnanswered = userAnswerKey.length === 0;
              const isUserCorrect = !isUnanswered && q.isCorrect === true;
              return (
                <Card
                  key={q.id}
                  data-answer-state={
                    isUnanswered ? 'unanswered' : isUserCorrect ? 'correct' : 'incorrect'
                  }
                  className={`p-6 bg-slate-900/10 border transition-all ${
                    isUnanswered
                      ? 'border-slate-700/60 hover:border-slate-600/70 bg-slate-800/10'
                      : isUserCorrect
                      ? 'border-emerald-500/20 hover:border-emerald-500/30 bg-emerald-500/5'
                      : 'border-rose-500/20 hover:border-rose-500/30 bg-rose-500/5'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 shrink-0">
                      {isUnanswered ? (
                        <HelpCircle className="w-5 h-5 text-slate-400" />
                      ) : isUserCorrect ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-500" />
                      )}
                    </div>
                    <div className="flex flex-col gap-4 w-full">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-slate-500 font-bold">
                          {t('exams.questionWithType', {
                            number: idx + 1,
                            type: t(q.type === 'mcq' ? 'exams.mcqShort' : 'exams.trueFalseShort'),
                          })}
                        </span>
                        <h4 className="text-base font-bold text-white leading-relaxed">{q.questionText}</h4>
                      </div>

                      {/* Options Grid */}
                      {options.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {options.map((opt: string, oIdx: number) => {
                            const optionKey = normalizeReviewKey(opt);
                            const isCorrectOpt =
                              correctAnswerKey.length > 0 && optionKey === correctAnswerKey;
                            const isUserOpt =
                              !isUnanswered && optionKey.length > 0 && optionKey === userAnswerKey;
                            return (
                              <div
                                key={oIdx}
                                className={`px-4 py-2.5 rounded-xl border text-sm flex items-center justify-between font-medium ${
                                  isCorrectOpt
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                    : isUserOpt
                                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                                    : 'bg-slate-950/40 border-slate-900 text-slate-400'
                                }`}
                              >
                                <span>{opt}</span>
                                {isCorrectOpt && <CheckCircle className="w-4 h-4 text-emerald-450 shrink-0" />}
                                {!isCorrectOpt && isUserOpt && <XCircle className="w-4 h-4 text-rose-450 shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Explanation box */}
                      {explanation && (
                        <div className="mt-2 text-xs bg-slate-950/30 border border-slate-900 p-4 rounded-xl leading-relaxed text-slate-350">
                          <span className="font-bold text-indigo-400 block mb-1.5 flex items-center gap-1">
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>{t('exams.explanation')}</span>
                          </span>
                          <span>{explanation}</span>
                        </div>
                      )}

                      {/* AI Personalized Feedback mini-lesson */}
                      {aiFeedback && (
                        <div className="mt-2 text-xs bg-violet-950/20 border border-violet-500/20 p-4 rounded-xl leading-relaxed text-slate-300">
                          <span className="font-bold text-violet-400 block mb-1.5 flex items-center gap-1">
                            <Brain className="w-3.5 h-3.5" />
                            <span>{t('exams.tutorFeedback')}</span>
                          </span>
                          <span className="whitespace-pre-line">{aiFeedback}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : attemptIsReleaseSafe ? (
        /* ================= TAKING QUIZ VIEW ================= */
        <form onSubmit={handleSubmitExam} className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
          <div className="flex flex-col gap-6">
            {exam.questions.map((q: any, idx: number) => (
              <Card key={q.id} className="p-6 bg-slate-900/20 border-slate-805/60 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-indigo-400 font-bold uppercase">
                    {t('exams.questionProgress', {
                      current: idx + 1,
                      total: exam.totalQuestions,
                    })}
                  </span>
                  <h3 className="text-base font-bold text-white leading-relaxed">{q.questionText}</h3>
                </div>

                {/* MCQ Options */}
                {q.type === 'mcq' && q.options && (
                  <div className="flex flex-col gap-2.5 mt-2">
                    {q.options.map((opt: string, oIdx: number) => {
                      const isSelected = answers[q.id] === opt;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => handleSelectOption(q.id, opt)}
                          className={`px-4 py-3 rounded-xl border text-sm text-right transition-all font-medium flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-650/15 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/5'
                              : 'bg-slate-950/20 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <span>{opt}</span>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-700'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* True/False Options */}
                {q.type === 'true_false' && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    {['True', 'False'].map((val) => {
                      const label = t(val === 'True' ? 'exams.true' : 'exams.false');
                      const isSelected = answers[q.id] === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleSelectOption(q.id, val)}
                          className={`px-4 py-3 rounded-xl border text-sm text-center transition-all font-bold cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-650/15 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/5'
                              : 'bg-slate-950/20 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-slate-800/40 pt-6">
            <span className="text-xs text-slate-400">
              {t('exams.submitHint')}
            </span>
            <Button type="submit" loading={submitting} className="px-6 font-bold cursor-pointer">
              <span>{t('exams.submit')}</span>
            </Button>
          </div>
        </form>
      ) : (
        <Card
          role="status"
          className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 border-amber-500/20 bg-amber-500/5 p-8 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10">
            <AlertTriangle className="h-7 w-7 text-amber-400" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-bold text-white">
              {t(isDraft ? 'exams.draftUnavailableTitle' : 'exams.unsupportedFormatTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-slate-400">
              {t(isDraft ? 'exams.draftUnavailableMessage' : 'exams.unsupportedFormatMessage')}
            </p>
          </div>
          <Button nativeButton={false} render={<Link href="/exams" />} variant="secondary">
            {t('exams.backToExams')}
          </Button>
        </Card>
      )}
    </div>
  );
}
