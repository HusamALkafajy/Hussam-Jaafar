'use client';

import React, { useEffect, useState, use } from 'react';
import { api } from '../../../../lib/api';
import { useLocale } from '../../../../hooks/use-locale';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Spinner } from '../../../../components/ui/spinner';
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
  Sparkles,
  Brain,
} from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ExamPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const examId = resolvedParams.id;
  const { t, locale } = useLocale();

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [generatingNext, setGeneratingNext] = useState(false);

  const fetchExam = async () => {
    setLoading(true);
    try {
      const data = await api.get<any>(`/exams/${examId}`);
      setExam(data);

      // Initialize timer if exam is active and has a time limit
      if (data.status === 'active' && data.timeLimitMinutes) {
        // Simple mock countdown matching time limit
        setTimeLeft(data.timeLimitMinutes * 60);
      }
    } catch (e) {
      console.error('Failed to load exam', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [examId]);

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) {
      if (timeLeft === 0 && exam?.status === 'active') {
        handleSubmitExam();
      }
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft]);

  const handleSelectOption = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmitExam = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!exam || exam.status === 'completed') return;

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
    } catch (err) {
      alert('Failed to submit exam: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextAdaptiveQuestion = async () => {
    setGeneratingNext(true);
    try {
      const newQuestion = await api.post<any>(`/exams/${examId}/next-question`);
      // Re-fetch the full exam to get the updated questions list
      const updatedExam = await api.get<any>(`/exams/${examId}`);
      setExam(updatedExam);
    } catch (err: any) {
      alert(locale === 'ar' ? 'فشل توليد السؤال: ' + err.message : 'Failed to generate question: ' + err.message);
    } finally {
      setGeneratingNext(false);
    }
  };

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
        <p className="text-slate-400">Exam not found or access denied.</p>
        <Link href="/exams">
          <Button>Back to Exams</Button>
        </Link>
      </div>
    );
  }

  const isCompleted = exam.status === 'completed';

  return (
    <div className="flex flex-col gap-6">
      {/* Exam Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/40 pb-6">
        <div className="flex items-start gap-4">
          <Link
            href={isCompleted ? '/exams' : `/files/${exam.fileId}`}
            className="mt-1 p-2 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
              <span>{exam.totalQuestions} {locale === 'ar' ? 'سؤال' : 'Questions'}</span>
            </div>
          </div>
        </div>

        {/* Timer or Status badge */}
        {!isCompleted && timeLeft !== null && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 font-mono text-lg font-bold self-start md:self-center">
            <Clock className="w-5 h-5 animate-pulse" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        )}

        {isCompleted && (
          <Badge variant="success" className="px-4 py-1.5 self-start md:self-center font-bold">
            {locale === 'ar' ? 'مكتمل' : 'Completed'}
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
                {locale === 'ar' ? 'النتيجة الإجمالية' : 'Overall Result'}
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
                    {Number(exam.score) >= 70 ? (locale === 'ar' ? 'ممتاز' : 'Excellent') : (locale === 'ar' ? 'يحتاج مراجعة' : 'Needs Review')}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-400 font-medium">
                {locale === 'ar'
                  ? `تاريخ الحل: ${new Date(exam.completedAt).toLocaleDateString(locale)}`
                  : `Completed on: ${new Date(exam.completedAt).toLocaleDateString(locale)}`}
              </div>
            </Card>

            {/* AI Strengths/Weaknesses card */}
            {(exam.strengthAnalysis || exam.weaknessAnalysis) && (
              <Card className="p-6 bg-slate-900/20 border-slate-805/60 flex flex-col gap-5">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-indigo-400" />
                  <span>{locale === 'ar' ? 'تحليل الأداء بالذكاء الاصطناعي' : 'AI Performance Diagnostics'}</span>
                </h4>

                {exam.strengthAnalysis && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-emerald-450 uppercase flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {locale === 'ar' ? 'نقاط القوة' : 'Strengths'}
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
                      {locale === 'ar' ? 'نقاط الضعف' : 'Weaknesses'}
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

            {/* Adaptive Mode — Generate Next Question */}
            {exam.weaknessAnalysis?.weakTopics?.length > 0 && (
              <Card className="p-5 bg-violet-950/20 border-violet-500/20 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-400" />
                  <h4 className="text-sm font-bold text-violet-300">
                    {locale === 'ar' ? 'وضع التكيّف الذكي' : 'Adaptive Mode'}
                  </h4>
                  {exam.adaptiveMode && (
                    <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-bold border border-violet-500/20">
                      {locale === 'ar' ? 'نشط' : 'Active'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {locale === 'ar'
                    ? 'الذكاء الاصطناعي يمكنه توليد أسئلة تكيّفية تستهدف نقاط ضعفك المحددة.'
                    : 'The AI can generate targeted follow-up questions for your identified weak areas.'}
                </p>
                <Button
                  onClick={handleNextAdaptiveQuestion}
                  loading={generatingNext}
                  className="w-full font-bold flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 border-violet-500"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{locale === 'ar' ? 'توليد سؤال تكيّفي جديد' : 'Generate Next Adaptive Question'}</span>
                </Button>
              </Card>
            )}

            {/* AI Recommendation plan */}
            {exam.studyPlan && (
              <Card className="p-6 bg-indigo-950/10 border-indigo-500/10 flex flex-col gap-4">
                <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <GraduationCap className="w-4.5 h-4.5" />
                  <span>{locale === 'ar' ? 'خطة المراجعة المقترحة' : 'Suggested Study Path'}</span>
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
              {locale === 'ar' ? 'مراجعة الإجابات التفصيلية' : 'Detailed Question Correction'}
            </h3>
            {exam.questions.map((q: any, idx: number) => {
              const isUserCorrect = q.isCorrect;
              return (
                <Card
                  key={q.id}
                  className={`p-6 bg-slate-900/10 border transition-all ${
                    isUserCorrect
                      ? 'border-emerald-500/20 hover:border-emerald-500/30 bg-emerald-500/5'
                      : 'border-rose-500/20 hover:border-rose-500/30 bg-rose-500/5'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 shrink-0">
                      {isUserCorrect ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-500" />
                      )}
                    </div>
                    <div className="flex flex-col gap-4 w-full">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-slate-500 font-bold">
                          {locale === 'ar' ? `السؤال ${idx + 1} (${q.type === 'mcq' ? 'اختياري' : 'صح/خطأ'})` : `Question ${idx + 1} (${q.type === 'mcq' ? 'MCQ' : 'T/F'})`}
                        </span>
                        <h4 className="text-base font-bold text-white leading-relaxed">{q.questionText}</h4>
                      </div>

                      {/* Options Grid */}
                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {q.options.map((opt: string, oIdx: number) => {
                            const isCorrectOpt = opt.toLowerCase() === q.correctAnswer.toLowerCase();
                            const isUserOpt = opt.toLowerCase() === q.userAnswer.toLowerCase();
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
                      {q.explanation && (
                        <div className="mt-2 text-xs bg-slate-950/30 border border-slate-900 p-4 rounded-xl leading-relaxed text-slate-350">
                          <span className="font-bold text-indigo-400 block mb-1.5 flex items-center gap-1">
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>{locale === 'ar' ? 'التفسير والشرح:' : 'Explanation:'}</span>
                          </span>
                          <span>{q.explanation}</span>
                        </div>
                      )}

                      {/* AI Personalized Feedback mini-lesson */}
                      {q.aiFeedback && (
                        <div className="mt-2 text-xs bg-violet-950/20 border border-violet-500/20 p-4 rounded-xl leading-relaxed text-slate-300">
                          <span className="font-bold text-violet-400 block mb-1.5 flex items-center gap-1">
                            <Brain className="w-3.5 h-3.5" />
                            <span>{locale === 'ar' ? 'تعليق المدرّس الذكي:' : 'AI Tutor Feedback:'}</span>
                          </span>
                          <span className="whitespace-pre-line">{q.aiFeedback}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        /* ================= TAKING QUIZ VIEW ================= */
        <form onSubmit={handleSubmitExam} className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
          <div className="flex flex-col gap-6">
            {exam.questions.map((q: any, idx: number) => (
              <Card key={q.id} className="p-6 bg-slate-900/20 border-slate-805/60 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-indigo-400 font-bold uppercase">
                    {locale === 'ar' ? `السؤال ${idx + 1} من ${exam.totalQuestions}` : `Question ${idx + 1} of ${exam.totalQuestions}`}
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
                      const label = val === 'True' ? (locale === 'ar' ? 'صح' : 'True') : (locale === 'ar' ? 'خطأ' : 'False');
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
              {locale === 'ar' ? 'تأكد من إجابة جميع الأسئلة قبل تسليم الاختبار.' : 'Make sure to answer all questions before submitting.'}
            </span>
            <Button type="submit" loading={submitting} className="px-6 font-bold cursor-pointer">
              <span>{locale === 'ar' ? 'إنهاء وتسليم الاختبار' : 'Finish & Submit Exam'}</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
