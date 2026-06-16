'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import { useLocale } from '../../../../hooks/use-locale';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Spinner } from '../../../../components/ui/spinner';
import {
  ArrowLeft,
  Compass,
  CheckCircle2,
  Lock,
  PlayCircle,
  Code,
  Sparkles,
  Award,
  ChevronRight,
  BookOpen,
  Check,
  AlertCircle,
  HelpCircle,
  X,
} from 'lucide-react';
import { Markdown } from '../../../../components/ui/markdown';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LearningPathDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const pathId = resolvedParams.id;
  const { locale } = useLocale();

  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<any | null>(null);
  const [selectedStage, setSelectedStage] = useState<any | null>(null);

  // Lesson Viewer Modal
  const [activeLesson, setActiveLesson] = useState<any | null>(null);
  const [completingLesson, setCompletingLesson] = useState(false);

  // Project Submission Workspace
  const [submissionCode, setSubmissionCode] = useState('');
  const [submittingProject, setSubmittingProject] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<any | null>(null);

  const loadPathDetail = async (selectStageId?: string) => {
    try {
      const data = await api.get<any>(`/learning-paths/${pathId}`);
      setPath(data);
      
      // Auto-select first active or completed stage if none selected
      if (data && data.stages && data.stages.length > 0) {
        if (selectStageId) {
          const matching = data.stages.find((s: any) => s.id === selectStageId);
          setSelectedStage(matching || data.stages[0]);
        } else if (!selectedStage) {
          const activeOrCompleted = data.stages.find((s: any) => s.status === 'active') || data.stages[0];
          setSelectedStage(activeOrCompleted);
        } else {
          // Keep current selected stage updated
          const matching = data.stages.find((s: any) => s.id === selectedStage.id);
          setSelectedStage(matching || data.stages[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load path details', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPathDetail();
  }, [pathId]);

  const handleCompleteLesson = async (lessonId: string) => {
    setCompletingLesson(true);
    try {
      const result = await api.patch<any>(`/learning-paths/lessons/${lessonId}/complete`);
      setActiveLesson(null);
      
      if (result) {
        window.dispatchEvent(new CustomEvent('gamification-update', { detail: result }));
      }
      
      await loadPathDetail(selectedStage?.id);
    } catch (err: any) {
      alert(locale === 'ar' ? 'فشل إكمال الدرس: ' + (err.message || err) : 'Failed to complete lesson: ' + (err.message || err));
    } finally {
      setCompletingLesson(false);
    }
  };

  const handleSubmitProject = async (projectId: string) => {
    if (!submissionCode.trim()) return;
    setSubmittingProject(true);
    setEvaluationResult(null);

    try {
      const result = await api.post<any>(`/projects/${projectId}/submit`, {
        studentSubmission: submissionCode,
      });
      setEvaluationResult(result);
      
      if (result && result.xpResult) {
        window.dispatchEvent(new CustomEvent('gamification-update', { detail: result.xpResult }));
      }
      
      // Clear submission input upon grading
      setSubmissionCode('');
      await loadPathDetail(selectedStage?.id);
    } catch (err: any) {
      alert(locale === 'ar' ? 'فشل تقييم المشروع: ' + (err.message || err) : 'Failed to evaluate project: ' + (err.message || err));
    } finally {
      setSubmittingProject(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!path) {
    return (
      <div className="text-center py-12 flex flex-col items-center gap-3">
        <p className="text-slate-400">{locale === 'ar' ? 'مسار التعلم غير موجود' : 'Learning path not found.'}</p>
        <Link href="/learning-paths">
          <Button>{locale === 'ar' ? 'العودة للمسارات' : 'Back to Paths'}</Button>
        </Link>
      </div>
    );
  }

  // Calculate overall roadmap progress percentage
  const completedStagesCount = path.stages.filter((s: any) => s.status === 'completed').length;
  const progressPercent = Math.round((completedStagesCount / path.stages.length) * 100);

  return (
    <div className="flex flex-col gap-6">
      {/* Detail Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/40 pb-5">
        <div className="flex items-start gap-4 min-w-0">
          <Link href="/learning-paths" className="mt-1 p-2 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4 rtl-flip" />
          </Link>
          <div className="flex flex-col gap-1.5 min-w-0">
            <h2 className="text-2xl font-bold text-white truncate max-w-[400px]">
              {path.skillName}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
              <span className="capitalize bg-slate-900 px-2 py-0.5 rounded border border-slate-800/30 text-indigo-400 font-bold">
                {path.difficultyLevel}
              </span>
              <span className="truncate max-w-[300px]">
                {locale === 'ar' ? `الهدف: ${path.endGoal}` : `Goal: ${path.endGoal}`}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar Header */}
        <div className="flex flex-col gap-1 w-full md:w-48 shrink-0">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{locale === 'ar' ? 'الإنجاز الكلي' : 'Overall Progress'}</span>
            <span className="font-bold text-white">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/60">
            <div
              className="bg-indigo-500 h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Timeline Panel */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider px-1">
            {locale === 'ar' ? 'مراحل المسار الدراسي' : 'ROADMAP TIMELINE'}
          </h3>
          <div className="flex flex-col relative before:absolute before:top-4 before:bottom-4 before:left-[21px] rtl:before:left-auto rtl:before:right-[21px] before:w-[2px] before:bg-slate-850/80">
            {path.stages.map((stage: any, idx: number) => {
              const isLocked = stage.status === 'locked';
              const isCompleted = stage.status === 'completed';
              const isActive = stage.status === 'active';
              const isSelected = selectedStage?.id === stage.id;

              return (
                <button
                  key={stage.id}
                  disabled={isLocked}
                  onClick={() => setSelectedStage(stage)}
                  className={`flex items-start gap-4 p-3.5 rounded-xl border transition-all text-left rtl:text-right w-full cursor-pointer relative z-10 mb-4 group ${
                    isSelected
                      ? 'bg-indigo-500/5 border-indigo-500/80 shadow-md shadow-indigo-500/2'
                      : isLocked
                      ? 'bg-slate-950/20 border-slate-900 opacity-60 cursor-not-allowed'
                      : 'bg-slate-900/10 border-slate-800/50 hover:border-slate-700/60'
                  }`}
                >
                  {/* Timeline Badge Point */}
                  <div
                    className={`w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 border mt-0.5 ${
                      isCompleted
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                        : isActive
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400 animate-pulse'
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-2.5 h-2.5" />
                    ) : isLocked ? (
                      <Lock className="w-2 h-2" />
                    ) : (
                      <PlayCircle className="w-2.5 h-2.5" />
                    )}
                  </div>

                  <div className="flex flex-col gap-1 min-w-0">
                    <h4 className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-400' : 'text-slate-200'}`}>
                      {stage.title}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {stage.description}
                    </p>
                    <span className="text-[10px] text-slate-500 mt-1 font-semibold flex items-center gap-1">
                      <span>{locale === 'ar' ? 'الزمن المقدر:' : 'Est:'}</span>
                      <span>{stage.estimatedHours} {locale === 'ar' ? 'ساعة' : 'hours'}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Stage Workspace Panel */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {selectedStage ? (
            <div className="flex flex-col gap-6">
              {/* Selected Stage Info */}
              <Card className="p-5 bg-slate-900/30 border-slate-800/40">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">{selectedStage.title}</h3>
                    <Badge
                      variant={
                        selectedStage.status === 'completed'
                          ? 'success'
                          : selectedStage.status === 'active'
                          ? 'warning'
                          : 'neutral'
                      }
                      className="px-2.5 py-0.5 text-[10px]"
                    >
                      {selectedStage.status === 'completed'
                        ? (locale === 'ar' ? 'مكتملة' : 'Completed')
                        : selectedStage.status === 'active'
                        ? (locale === 'ar' ? 'نشطة' : 'Active')
                        : (locale === 'ar' ? 'مغلقة' : 'Locked')}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{selectedStage.description}</p>
                </div>
              </Card>

              {/* Stage Lessons Tab block */}
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider px-1">
                  {locale === 'ar' ? 'الدروس التعليمية' : 'Milestone Lessons'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedStage.lessons?.map((lesson: any) => (
                    <Card
                      key={lesson.id}
                      onClick={() => setActiveLesson(lesson)}
                      className={`p-4 bg-slate-900/20 hover:bg-slate-900/45 hover:border-slate-700/60 border border-slate-800/40 transition-all cursor-pointer flex items-center justify-between gap-3 group`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${lesson.isCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <h5 className="text-sm font-bold text-white truncate group-hover:text-indigo-400 transition-colors">
                            {lesson.title}
                          </h5>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {lesson.isCompleted ? (locale === 'ar' ? 'تمت قراءته' : 'Completed') : (locale === 'ar' ? 'غير مقروء' : 'Unread')}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors rtl-flip" />
                    </Card>
                  ))}
                </div>
              </div>

              {/* Stage Project block (unlocked only if all lessons in current stage are completed) */}
              {selectedStage.project && (
                <div className="flex flex-col gap-4 border-t border-slate-800/30 pt-6">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Code className="w-4 h-4 text-indigo-400" />
                      <span>{locale === 'ar' ? 'المشروع التطبيقي للمرحلة' : 'Stage Capstone Project'}</span>
                    </h4>
                    <Badge variant={selectedStage.project.status === 'graded' ? 'success' : 'neutral'} className="px-2 py-0.5 text-[9px] uppercase">
                      {selectedStage.project.status}
                    </Badge>
                  </div>

                  {/* If lessons remain uncompleted */}
                  {selectedStage.lessons?.some((l: any) => !l.isCompleted) ? (
                    <Card className="p-6 bg-slate-950/20 border-slate-900 flex flex-col items-center justify-center gap-3 text-center py-10">
                      <Lock className="w-8 h-8 text-slate-600" />
                      <div className="flex flex-col gap-1 max-w-sm">
                        <h5 className="text-sm font-bold text-slate-350">{locale === 'ar' ? 'المشروع مغلق حالياً' : 'Project is Locked'}</h5>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {locale === 'ar'
                            ? 'أكمل قراءة وفهم جميع الدروس التعليمية في هذه المرحلة أولاً لتتمكن من بدء المشروع.'
                            : 'Complete reading and understanding all stage lessons first to unlock the capstone project submission.'}
                        </p>
                      </div>
                    </Card>
                  ) : (
                    <div className="flex flex-col gap-6">
                      {/* Project description card */}
                      <Card className="p-5 bg-slate-900/10 border-slate-850 flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                          <h5 className="text-base font-bold text-white">{selectedStage.project.title}</h5>
                          <Markdown content={selectedStage.project.description} className="text-xs" />
                        </div>

                        {selectedStage.project.starterCode && (
                          <div className="flex flex-col gap-1.5 mt-2">
                            <span className="text-[10px] font-bold text-slate-400">{locale === 'ar' ? 'كود البداية المقترح:' : 'Starter Code / Specifications:'}</span>
                            <pre className="bg-slate-950 border border-slate-850 p-3 rounded-lg text-left font-mono text-xs text-slate-300 overflow-x-auto select-all cursor-copy">
                              {selectedStage.project.starterCode}
                            </pre>
                          </div>
                        )}
                      </Card>

                      {/* AI Evaluation result display */}
                      {selectedStage.project.status === 'graded' && (
                        <Card className={`p-5 border ${selectedStage.project.score >= 70 ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'} flex flex-col gap-4`}>
                          <div className="flex items-center justify-between border-b border-slate-800/30 pb-3">
                            <div className="flex items-center gap-2">
                              {selectedStage.project.score >= 70 ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-rose-400" />
                              )}
                              <h5 className="text-sm font-bold text-white">
                                {locale === 'ar' ? 'تقييم المصحح الذكي بالذكاء الاصطناعي' : 'AI Exam Agent Assessment'}
                              </h5>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className={`text-2xl font-black ${selectedStage.project.score >= 70 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {selectedStage.project.score}
                              </span>
                              <span className="text-[10px] text-slate-500">/100</span>
                            </div>
                          </div>

                          <Markdown content={selectedStage.project.feedbackText} className="text-xs" />

                          {/* Knowledge Gaps if failed */}
                          {selectedStage.gaps && selectedStage.gaps.length > 0 && (
                            <div className="flex flex-col gap-3 border-t border-slate-800/30 pt-4 mt-1">
                              <h6 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{locale === 'ar' ? 'فجوات مهارية تم رصدها' : 'Detected Knowledge Gaps'}</span>
                              </h6>
                              <div className="flex flex-col gap-2.5">
                                {selectedStage.gaps.map((gap: any) => (
                                  <div key={gap.id} className="bg-rose-950/10 border border-rose-900/20 p-3 rounded-lg flex flex-col gap-1">
                                    <span className="text-xs font-bold text-white capitalize">{gap.concept}</span>
                                    <p className="text-[11px] text-slate-400 leading-normal">{gap.remedialAction}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </Card>
                      )}

                      {/* Submission Workspace Form (Visible if graded < 70 or pending) */}
                      {(selectedStage.project.status !== 'graded' || selectedStage.project.score < 70) && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSubmitProject(selectedStage.project.id);
                          }}
                          className="flex flex-col gap-3.5 border-t border-slate-800/25 pt-5"
                        >
                          <label className="text-xs font-bold text-slate-400 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                            <span>{locale === 'ar' ? 'مساحة العمل ولصق كود الحل:' : 'Solution Workspace / Submission Text:'}</span>
                          </label>
                          <textarea
                            required
                            rows={8}
                            placeholder={
                              locale === 'ar'
                                ? 'لصق حل مشروع البرمجة هنا أو كتابة تقرير الحل...'
                                : 'Paste your solution code, script or explanation here for AI Code Review...'
                            }
                            value={submissionCode}
                            onChange={(e) => setSubmissionCode(e.target.value)}
                            disabled={submittingProject}
                            className="flex w-full rounded-md border border-slate-800 bg-slate-950 px-3.5 py-3 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 leading-normal"
                          />
                          <div className="flex justify-end">
                            <Button
                              type="submit"
                              loading={submittingProject}
                              disabled={!submissionCode.trim()}
                              className="gradient-primary text-white font-bold cursor-pointer shrink-0"
                            >
                              <Sparkles className="w-4 h-4 mr-1.5 rtl:ml-1.5" />
                              <span>{locale === 'ar' ? 'تسليم للمراجعة والتقييم' : 'Submit for AI Grading'}</span>
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              {locale === 'ar' ? 'حدد مرحلة لعرض مساحة العمل' : 'Select a stage node to load workspace.'}
            </div>
          )}
        </div>
      </div>

      {/* Lesson Viewer Modal */}
      {activeLesson && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl bg-slate-900 border-slate-800 p-0 flex flex-col relative max-h-[90vh] overflow-hidden rounded-xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800/40 flex items-center justify-between bg-slate-950/10">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="w-5 h-5 text-indigo-400 shrink-0" />
                <h3 className="text-base font-bold text-white truncate">{activeLesson.title}</h3>
              </div>
              <button
                onClick={() => setActiveLesson(null)}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 border-b border-slate-800/30">
              <Markdown content={activeLesson.content} />
            </div>

            {/* Modal Action Footer */}
            <div className="p-4 flex justify-between items-center bg-slate-950/20">
              <span className="text-[10px] text-slate-500 font-semibold">
                {activeLesson.isCompleted ? (locale === 'ar' ? 'الدرس مكتمل' : 'Lesson is Completed') : ''}
              </span>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveLesson(null)}
                  className="border-slate-800 text-slate-400 hover:text-white cursor-pointer font-semibold"
                >
                  <span>{locale === 'ar' ? 'إغلاق' : 'Close'}</span>
                </Button>
                {!activeLesson.isCompleted && (
                  <Button
                    onClick={() => handleCompleteLesson(activeLesson.id)}
                    loading={completingLesson}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    <Check className="w-4 h-4 mr-1.5 rtl:ml-1.5" />
                    <span>{locale === 'ar' ? 'تحديد كمقروء ومكتمل' : 'Mark as Completed'}</span>
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
