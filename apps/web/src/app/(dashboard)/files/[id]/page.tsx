'use client';

import React, { useEffect, useState, use, useRef, useCallback } from 'react';
import { api } from '../../../../lib/api-client';
import { useLocale } from '../../../../hooks/use-locale';
import { Card } from '../../../../components/ui/card';
import { Button, buttonVariants } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Spinner } from '../../../../components/ui/spinner';
import { Input } from '../../../../components/ui/input';
import { Markdown } from '../../../../components/ui/markdown';
import { ContentReader, ContentReaderSkeleton } from '../../../../components/ui/content-reader';
import { OriginalPdfReader } from '../../../../components/reader/original-pdf-reader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import {
  FileText, Brain, ListRestart, HelpCircle, MessageSquare, Sparkles,
  ArrowLeft, Calendar, Layers, FileCheck, Send, BookOpen, AlertTriangle,
  RefreshCw, CheckCircle2, XCircle, Clock, Zap, Target, BarChart3,
  ChevronRight, Star, Check,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatBytes, formatDate, cn } from '../../../../lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'original', key: 'files.tabOriginal', icon: BookOpen },
  { id: 'extracted', key: 'files.tabExtractedText', icon: FileText },
  { id: 'summary', key: 'files.tabSummary', icon: Sparkles },
  { id: 'explain', key: 'files.tabExplain', icon: Brain },
  { id: 'quiz', key: 'files.tabExam', icon: ListRestart },
  { id: 'flashcards', key: 'files.tabFlashcards', icon: HelpCircle },
  { id: 'chat', key: 'files.tabChat', icon: MessageSquare },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Pill-style segmented tab navigator */
function TabNav({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  const { t } = useLocale();
  return (
    <div className="relative">
      {/* Scrollable row */}
      <div className="flex overflow-x-auto scrollbar-none gap-1 p-1 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? 'default' : 'ghost'}
              onClick={() => onChange(tab.id)}
              className={cn(
                "rounded-xl gap-2",
                isActive ? "shadow-lg shadow-indigo-600/25" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{t(tab.key)}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/** File header card */
function FileHeader({
  file, locale, onReprocess, reprocessing,
}: {
  file: any;
  locale: string;
  onReprocess: () => void;
  reprocessing: boolean;
}) {
  const { t } = useLocale();
  const statusMap = {
    completed: { label: t('files.statusCompleted'), icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    failed: { label: t('files.statusFailed'), icon: XCircle, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
    processing: { label: t('files.statusProcessing'), icon: RefreshCw, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    pending: { label: t('files.statusPending'), icon: Clock, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    ocr_required: { label: t('files.statusOcrRequired'), icon: AlertTriangle, color: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  } as const;

  const status = statusMap[(file.processingStatus as keyof typeof statusMap)] ?? statusMap.pending;
  const StatusIcon = status.icon;

  return (
    <Card className="relative overflow-hidden border border-white/5 bg-gradient-to-br from-slate-900 via-slate-900/95 to-indigo-950/30 p-6 shadow-xl ring-0">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-indigo-600/10 blur-3xl" />

      <div className="relative flex flex-col md:flex-row md:items-start gap-5">
        {/* Back + icon */}
        <div className="flex items-start gap-4">
          <Link
            href="/files"
            className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), "mt-1 rounded-xl border-white/10 bg-transparent hover:bg-white/5 text-slate-400 hover:text-white")}
          >
            <ArrowLeft className="w-4 h-4 rtl-flip" />
          </Link>

          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-indigo-400" />
          </div>
        </div>

        {/* Title & meta */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate max-w-[500px] mb-3">
            {file.originalName}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {formatDate(file.createdAt, locale)}
            </span>
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              {formatBytes(file.fileSize)}
            </span>
            <span className="flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-slate-500" />
              <span className="capitalize">{file.fileType}</span>
            </span>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${status.color}`}>
            <StatusIcon className={`w-3.5 h-3.5 ${file.processingStatus === 'processing' ? 'animate-spin' : ''}`} />
            {status.label}
          </div>
          {file.processingStatus === 'failed' && (
            <Button onClick={onReprocess} loading={reprocessing} size="sm" className="bg-rose-600/80 hover:bg-rose-600 text-white text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              {t('workspace.retry')}
            </Button>
          )}
          {file.processingStatus === 'completed' && (
            <Button
              nativeButton={false}
              render={<Link href={`/tutor/${file.id}`} />}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/20"
            >
              <Brain className="w-4 h-4 mr-1.5" />
              {t('workspace.aiTutor')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Processing state while waiting for backend */
function ProcessingState() {
  const { t } = useLocale();
  return (
    <div className="py-16 flex flex-col items-center gap-6 text-center">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center">
          <Spinner className="w-8 h-8 text-indigo-400" />
        </div>
        <div className="absolute inset-0 rounded-full bg-indigo-500/5 animate-ping" />
      </div>
      <div>
        <h3 className="text-base font-bold text-white mb-2">
          {t('workspace.analyzingTitle')}
        </h3>
        <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
          {t('workspace.analyzingDescription')}
        </p>
      </div>
      <ContentReaderSkeleton />
    </div>
  );
}

/** Failed state */
function FailedState({ onReprocess, reprocessing }: { onReprocess: () => void; reprocessing: boolean }) {
  const { t } = useLocale();
  return (
    <div className="py-14 flex flex-col items-center gap-6 max-w-md mx-auto text-center">
      <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
        <AlertTriangle className="w-9 h-9 text-rose-400" />
      </div>
      <div>
        <h3 className="text-base font-bold text-white mb-2">
          {t('workspace.analysisFailedTitle')}
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          {t('workspace.analysisFailedDescription')}
        </p>
      </div>
      <Button onClick={onReprocess} loading={reprocessing} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
        <RefreshCw className="w-4 h-4 mr-2" />
        {t('workspace.retryAnalysis')}
      </Button>
    </div>
  );
}

function OcrRequiredState() {
  const { t } = useLocale();
  return (
    <div className="py-14 flex flex-col items-center gap-4 max-w-md mx-auto text-center" role="status">
      <AlertTriangle className="w-10 h-10 text-amber-400" aria-hidden="true" />
      <h3 className="text-base font-bold text-white">{t('files.ocrRequiredTitle')}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{t('files.ocrRequiredDescription')}</p>
    </div>
  );
}

/** AI action control panel (summary / explain) */
function AiControlPanel({
  title, description, selectLabel, options, value, onChange, onGenerate, loading, disabled, locale, ctaLabel, processingStatus,
}: {
  title: string;
  description: string;
  selectLabel: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  loading: boolean;
  disabled?: boolean;
  locale: string;
  ctaLabel: string;
  processingStatus?: string;
}) {
  const { t } = useLocale();
  const selectLabelId = React.useId();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900 to-indigo-950/20 p-6 shadow-lg">
      <div className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 rounded-full bg-indigo-600/10 blur-2xl" />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-bold text-white">{title}</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
        </div>
        <div className="flex w-full shrink-0 items-stretch gap-3 sm:w-auto sm:items-center">
          {processingStatus && ['pending', 'processing'].includes(processingStatus) ? (
            <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-xl text-xs text-indigo-300 font-semibold animate-pulse">
              <Spinner className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {t('workspace.processingDocument')}
              </span>
            </div>
          ) : processingStatus === 'failed' ? (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl text-xs text-rose-300 font-semibold">
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>
                {t('workspace.processingFailed')}
              </span>
            </div>
          ) : (
            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-end">
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-36">
                <span id={selectLabelId} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {selectLabel}
                </span>
                <Select value={value} onValueChange={(nextValue) => nextValue !== null && onChange(nextValue)} disabled={disabled}>
                  <SelectTrigger
                    aria-labelledby={selectLabelId}
                    className="h-10 w-full min-w-0 rounded-xl border-white/10 bg-slate-950/80 px-3 py-2 text-slate-300 sm:min-w-36"
                  >
                    <SelectValue>
                      {options.find((option) => option.value === value)?.label ?? value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col">
                <Button onClick={onGenerate} loading={loading} disabled={disabled} className="h-10 w-full px-5 font-bold sm:w-auto">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  {ctaLabel}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Generating placeholder */
function GeneratingCard() {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
        <Sparkles className="w-5 h-5 text-indigo-400 animate-spin" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">
          {t('workspace.generating')}
        </p>
        <p className="text-xs text-slate-400">
          {t('workspace.generationWait')}
        </p>
      </div>
    </div>
  );
}

/** Key points list */
function KeyPointsList({ points }: { points: string[] }) {
  const { t } = useLocale();
  if (!points?.length) return null;
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-bold text-emerald-300">{t('workspace.keyTakeaways')}</h3>
      </div>
      <ul className="flex flex-col gap-2.5">
        {points.map((p: string, i: number) => (
          <li key={i} className="flex items-start gap-3 text-sm text-slate-300 leading-relaxed">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Definitions grid */
function DefinitionsGrid({ defs }: { defs: any[] }) {
  const { t } = useLocale();
  if (!defs?.length) return null;
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-6">
      <h3 className="text-sm font-bold text-white mb-4">{t('workspace.definitions')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {defs.map((d: any, i: number) => (
          <div key={i} className="p-4 rounded-xl border border-indigo-500/15 bg-indigo-500/5">
            <span className="block text-xs font-bold text-indigo-400 mb-1.5">{d.term}</span>
            <span className="text-sm text-slate-300 leading-relaxed">{d.definition}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Formulas grid */
function FormulasGrid({ laws }: { laws: any[] }) {
  const { t } = useLocale();
  if (!laws?.length) return null;
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-6">
      <h3 className="text-sm font-bold text-white mb-4">{t('workspace.formulas')}</h3>
      <div className="flex flex-col gap-3">
        {laws.map((l: any, i: number) => (
          <div key={i} className="p-4 rounded-xl border border-amber-500/15 bg-amber-500/5">
            <span className="block text-xs font-bold text-amber-400 mb-2">{l.name}</span>
            <code className="block text-center font-mono text-sm text-amber-200 bg-black/30 py-2 px-3 rounded-lg mb-2">
              {l.formula}
            </code>
            {l.explanation && <span className="text-xs text-slate-400">{l.explanation}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FileDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const fileId = resolvedParams.id;
  const { locale, t } = useLocale();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [file, setFile] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('original');

  // Summary
  const [summaryLevel, setSummaryLevel] = useState<'short' | 'medium' | 'comprehensive'>('medium');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryResult, setSummaryResult] = useState<any | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Explanation
  const [explainLevel, setExplainLevel] = useState<'simple' | 'intermediate' | 'academic'>('intermediate');
  const [generatingExplain, setGeneratingExplain] = useState(false);
  const [explainResult, setExplainResult] = useState<any | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);

  // Chat
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string; references?: any }>>([]);
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Exam
  const [examDifficulty, setExamDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [examTotalQuestions, setExamTotalQuestions] = useState(10);
  const [examQuestionTypes, setExamQuestionTypes] = useState<string[]>(['mcq', 'true_false']);
  const [generatingExam, setGeneratingExam] = useState(false);
  const [previousExams, setPreviousExams] = useState<any[]>([]);

  // Flashcards
  const [flashcardsCount, setFlashcardsCount] = useState(10);
  const [flashcardSetTitle, setFlashcardSetTitle] = useState('');
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [previousSets, setPreviousSets] = useState<any[]>([]);

  const loadFile = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await api.get<any>(`/files/${fileId}`);
      setFile(data);
    } catch (e) {
      console.error('Failed to load file details', e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [fileId]);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      await api.post(`/files/${fileId}/reprocess`);
      await loadFile();
    } catch {
      alert(t('workspace.retryFailure'));
    } finally {
      setReprocessing(false);
    }
  };

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const [examsData, setsData] = await Promise.all([
          api.get<any[]>('/exams'),
          api.get<any[]>('/flashcard-sets'),
        ]);
        setPreviousExams((examsData || []).filter((e: any) => e.fileId === fileId));
        setPreviousSets((setsData || []).filter((s: any) => s.fileId === fileId));
      } catch { }
    };

    loadFile(); 
    loadHistory(); 
  }, [fileId, loadFile]);

  useEffect(() => {
    if (file && ['pending', 'processing'].includes(file.processingStatus)) {
      const iv = setInterval(() => loadFile(false), 3000);
      return () => clearInterval(iv);
    }
  }, [file, loadFile]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    setSummaryError(null);
    try {
      const result = await api.post<any>(`/files/${fileId}/summary`, { level: summaryLevel, language: locale });
      setSummaryResult(result);
    } catch (err: any) {
      console.error('Summary generation failed:', err);
      setSummaryError(t('workspace.summaryFailure'));
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleGenerateExplanation = async () => {
    setGeneratingExplain(true);
    setExplainError(null);
    try {
      const result = await api.post<any>(`/files/${fileId}/explain`, { level: explainLevel, language: locale });
      setExplainResult(result);
    } catch (err: any) {
      console.error('Explanation generation failed:', err);
      setExplainError(t('workspace.explanationFailure'));
    } finally {
      setGeneratingExplain(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    const msg = chatMessage;
    setChatMessage('');
    setChatHistory((prev) => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const result = await api.post<any>(`/files/${fileId}/chat`, { content: msg }, { signal: controller.signal });
      clearTimeout(timeoutId);
      setChatHistory((prev) => [...prev, { role: 'assistant', content: result.content, references: result.references }]);
    } catch { 
      clearTimeout(timeoutId);
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: t('workspace.tutorBusy') },
      ]);
    }
    finally { setChatLoading(false); }
  };

  const handleGenerateExam = async () => {
    setGeneratingExam(true);
    try {
      const exam = await api.post<any>('/exams', { fileId, difficulty: examDifficulty, totalQuestions: examTotalQuestions, questionTypes: examQuestionTypes });
      router.push(`/exams/${exam.id}`);
    } catch { alert(t('workspace.examGenerationFailure')); }
    finally { setGeneratingExam(false); }
  };

  const handleGenerateFlashcards = async () => {
    setGeneratingFlashcards(true);
    try {
      const set = await api.post<any>('/flashcard-sets', { fileId, title: flashcardSetTitle.trim() || undefined, count: flashcardsCount });
      router.push(`/flashcards/${set.id}`);
    } catch { alert(t('workspace.flashcardGenerationFailure')); }
    finally { setGeneratingFlashcards(false); }
  };

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-32 rounded-2xl bg-white/5" />
        <div className="h-12 rounded-2xl bg-white/5" />
        <div className="h-64 rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="py-20 flex flex-col items-center gap-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <XCircle className="w-8 h-8 text-rose-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white mb-1">{t('files.notFoundTitle')}</h3>
          <p className="text-sm text-slate-400">{t('files.notFoundDescription')}</p>
        </div>
        <Button nativeButton={false} render={<Link href="/files" />}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('files.backToFiles')}
        </Button>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* File header */}
      <FileHeader file={file} locale={locale} onReprocess={handleReprocess} reprocessing={reprocessing} />

      {/* Tab navigator */}
      <TabNav active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div className="mt-1">

        {/* ── Content tab ─────────────────────────────────────────────────── */}
        {activeTab === 'original' && (
          file.fileType === 'pdf' ? (
            <OriginalPdfReader
              fileId={fileId}
              label={t('files.tabOriginal')}
              labels={{
                loading: t('files.pdfLoading'),
                failed: t('files.pdfLoadFailed'),
                retry: t('workspace.retry'),
                previous: t('files.pdfPreviousPage'),
                next: t('files.pdfNextPage'),
                zoomIn: t('files.pdfZoomIn'),
                zoomOut: t('files.pdfZoomOut'),
                fitWidth: t('files.pdfFitWidth'),
                page: t('files.pdfPage'),
              }}
            />
          ) : <ProcessingState />
        )}

        {activeTab === 'extracted' && (
          <>
            {file.processingStatus === 'completed' && file.extractedText ? (
              <ContentReader content={file.extractedText} showProgress showToc />
            ) : file.processingStatus === 'ocr_required' ? (
              <OcrRequiredState />
            ) : file.processingStatus === 'failed' ? (
              <FailedState onReprocess={handleReprocess} reprocessing={reprocessing} />
            ) : (
              <ProcessingState />
            )}
          </>
        )}

        {/* ── Summary tab ──────────────────────────────────────────────────── */}
        {activeTab === 'summary' && (
          <div className="flex flex-col gap-6">
            <AiControlPanel
              title={t('workspace.generateSummary')}
              description={t('workspace.summaryDescription')}
              selectLabel={t('workspace.level')}
              options={[
                { value: 'short', label: t('workspace.summaryShort') },
                { value: 'medium', label: t('workspace.summaryMedium') },
                { value: 'comprehensive', label: t('workspace.summaryComprehensive') },
              ]}
              value={summaryLevel}
              onChange={(v: any) => setSummaryLevel(v)}
              onGenerate={handleGenerateSummary}
              loading={generatingSummary}
              disabled={file.processingStatus !== 'completed'}
              locale={locale}
              ctaLabel={t('workspace.summarize')}
              processingStatus={file.processingStatus}
            />

            {summaryError && (
              <div className="flex items-center gap-3 p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-300">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div className="flex-1 text-sm leading-relaxed">
                  <p className="font-bold mb-1">{t('workspace.summaryError')}</p>
                  <p className="text-xs opacity-90">{summaryError}</p>
                </div>
              </div>
            )}

            {generatingSummary && !summaryResult && <GeneratingCard />}

            {summaryResult && (
              <div className="flex flex-col gap-6">
                <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-8">
                  <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    {t('workspace.summary')}
                  </h3>
                  <Markdown content={summaryResult.content} />
                </div>
                <KeyPointsList points={summaryResult.keyPoints} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <DefinitionsGrid defs={summaryResult.definitions} />
                  <FormulasGrid laws={summaryResult.lawsFormulas} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Explain tab ───────────────────────────────────────────────────── */}
        {activeTab === 'explain' && (
          <div className="flex flex-col gap-6">
            <AiControlPanel
              title={t('workspace.generateExplanation')}
              description={t('workspace.explanationDescription')}
              selectLabel={t('workspace.depth')}
              options={[
                { value: 'simple', label: t('workspace.simple') },
                { value: 'intermediate', label: t('workspace.intermediate') },
                { value: 'academic', label: t('workspace.academic') },
              ]}
              value={explainLevel}
              onChange={(v: any) => setExplainLevel(v)}
              onGenerate={handleGenerateExplanation}
              loading={generatingExplain}
              disabled={file.processingStatus !== 'completed'}
              locale={locale}
              ctaLabel={t('workspace.explain')}
              processingStatus={file.processingStatus}
            />

            {explainError && (
              <div className="flex items-center gap-3 p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-300">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div className="flex-1 text-sm leading-relaxed">
                  <p className="font-bold mb-1">{t('workspace.explanationError')}</p>
                  <p className="text-xs opacity-90">{explainError}</p>
                </div>
              </div>
            )}

            {generatingExplain && !explainResult && <GeneratingCard />}

            {explainResult && (
              <div className="flex flex-col gap-6">
                <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-8">
                  <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    {t('workspace.explanation')}
                  </h3>
                  <Markdown content={explainResult.content} />
                </div>

                {/* Examples */}
                {explainResult.examples?.length > 0 && (
                  <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-6">
                    <h3 className="text-sm font-bold text-white mb-4">
                      {t('workspace.examples')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {explainResult.examples.map((ex: string, i: number) => (
                        <div key={i} className="p-4 rounded-xl border border-indigo-500/15 bg-indigo-500/5 text-sm text-indigo-200 leading-relaxed">
                          <span className="block text-[10px] font-bold text-indigo-400 mb-2 uppercase tracking-wider">
                            {t('workspace.example', { number: i + 1 })}
                          </span>
                          {ex}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comprehension questions */}
                {explainResult.comprehensionQuestions?.length > 0 && (
                  <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-6">
                    <h3 className="text-sm font-bold text-white mb-4">
                      {t('workspace.comprehensionQuestions')}
                    </h3>
                    <div className="flex flex-col gap-3">
                      {explainResult.comprehensionQuestions.map((q: any, i: number) => (
                        <details
                          key={i}
                          className="group rounded-xl border border-white/5 bg-slate-950/30 overflow-hidden"
                        >
                          <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none hover:bg-white/[0.02] transition-colors list-none">
                            <span className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-sm font-semibold text-slate-200 flex-1">{q.question}</span>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform shrink-0" />
                          </summary>
                          <div className="px-5 pb-5 pt-2 text-sm text-slate-300 leading-relaxed border-t border-white/5 bg-white/[0.01]">
                            {q.answer}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Quiz tab ──────────────────────────────────────────────────────── */}
        {activeTab === 'quiz' && (
          <div className="flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900 to-indigo-950/20 p-6 shadow-lg">
              <div className="pointer-events-none absolute -right-10 -top-10 w-48 h-48 rounded-full bg-indigo-600/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-5">
                  <Target className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-sm font-bold text-white">
                    {t('workspace.generateExam')}
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                  {/* Difficulty */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {t('workspace.difficulty')}
                    </label>
                    <div className="flex gap-2">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setExamDifficulty(d)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            examDifficulty === d
                              ? d === 'easy' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                : d === 'medium' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {t(`workspace.${d}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Count */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {t('workspace.questionCount')}
                    </label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setExamTotalQuestions(Math.max(5, examTotalQuestions - 5))} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors text-lg font-bold cursor-pointer">−</button>
                      <span className="flex-1 text-center text-lg font-bold text-white">{examTotalQuestions}</span>
                      <button onClick={() => setExamTotalQuestions(Math.min(50, examTotalQuestions + 5))} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors text-lg font-bold cursor-pointer">+</button>
                    </div>
                  </div>

                  {/* Types */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {t('workspace.questionTypes')}
                    </label>
                    <div className="flex flex-col gap-2">
                      {[
                        { id: 'mcq', label: t('workspace.multipleChoice') },
                        { id: 'true_false', label: t('workspace.trueFalse') },
                      ].map((type) => (
                        <label key={type.id} className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer select-none group">
                          <div
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              examQuestionTypes.includes(type.id)
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'border-slate-600 group-hover:border-slate-400'
                            }`}
                            onClick={() => setExamQuestionTypes(prev => prev.includes(type.id) ? prev.filter(t => t !== type.id) : [...prev, type.id])}
                          >
                            {examQuestionTypes.includes(type.id) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span>{type.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-white/5 pt-5">
                  <Button
                    onClick={handleGenerateExam}
                    loading={generatingExam}
                    disabled={examQuestionTypes.length === 0 || examTotalQuestions < 5}
                    className="font-bold px-6"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t('workspace.generateExamAction')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Previous exams */}
            {previousExams.length > 0 && (
              <div>
                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  {t('workspace.previousExams')}
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {previousExams.map((ex) => (
                    <div key={ex.id} className="rounded-2xl border border-white/5 bg-slate-900/30 p-5 flex flex-col gap-4 hover:border-white/10 transition-all">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${
                          ex.difficulty === 'easy' ? 'bg-emerald-500/15 text-emerald-400' :
                          ex.difficulty === 'hard' ? 'bg-rose-500/15 text-rose-400' :
                          'bg-amber-500/15 text-amber-400'
                        }`}>{ex.difficulty}</span>
                        <span className="text-xs text-slate-500">{new Date(ex.createdAt).toLocaleDateString(locale)}</span>
                      </div>
                      <div>
                        <h6 className="text-sm font-bold text-white line-clamp-1 mb-1">{ex.title}</h6>
                        <p className="text-xs text-slate-400">{t('workspace.questions', { count: ex.totalQuestions })}</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-4">
                        {ex.status === 'completed' ? (
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                            <span className={`text-sm font-bold ${Number(ex.score) >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {ex.score}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {t('workspace.inProgress')}
                          </span>
                        )}
                        <Button
                          nativeButton={false}
                          render={<Link href={`/exams/${ex.id}`} />}
                          size="sm"
                          variant={ex.status === 'completed' ? 'secondary' : 'primary'}
                        >
                          {ex.status === 'completed'
                            ? t('workspace.viewResults')
                            : t('workspace.takeExam')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Flashcards tab ────────────────────────────────────────────────── */}
        {activeTab === 'flashcards' && (
          <div className="flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900 to-purple-950/20 p-6 shadow-lg">
              <div className="pointer-events-none absolute -left-10 -top-10 w-48 h-48 rounded-full bg-purple-600/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-5">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <h4 className="text-sm font-bold text-white">
                    {t('workspace.generateFlashcards')}
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {t('workspace.setTitle')}
                    </label>
                    <Input
                      placeholder={t('workspace.setTitlePlaceholder')}
                      value={flashcardSetTitle}
                      onChange={(e) => setFlashcardSetTitle(e.target.value)}
                      className="bg-slate-950/60 border-white/10 focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {t('workspace.cardCount')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[5, 10, 15, 20, 30].map((n) => (
                        <button
                          key={n}
                          onClick={() => setFlashcardsCount(n)}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                            flashcardsCount === n
                              ? 'bg-purple-600/25 border-purple-500/50 text-purple-300'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-white/5 pt-5">
                  <Button onClick={handleGenerateFlashcards} loading={generatingFlashcards} className="font-bold px-6 bg-purple-600 hover:bg-purple-500">
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t('workspace.generateCards')}
                  </Button>
                </div>
              </div>
            </div>

            {previousSets.length > 0 && (
              <div>
                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  {t('workspace.previousSets')}
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {previousSets.map((set) => (
                    <div key={set.id} className="rounded-2xl border border-white/5 bg-slate-900/30 p-5 flex flex-col gap-4 hover:border-white/10 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{new Date(set.createdAt).toLocaleDateString(locale)}</span>
                        <span className="text-xs font-bold text-purple-400">{t('workspace.cards', { count: set.totalCards })}</span>
                      </div>
                      <h6 className="text-sm font-bold text-white line-clamp-1">{set.title}</h6>
                      <div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                          <span>{t('workspace.mastery')}</span>
                          <span className="font-semibold text-emerald-400">{set.masteredCount}/{set.totalCards}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                            style={{ width: `${(set.masteredCount / set.totalCards) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-3">
                        <span className="text-xs text-slate-500">
                          {t('workspace.reviews', { count: set.reviewCount })}
                        </span>
                        <Button
                          nativeButton={false}
                          render={<Link href={`/flashcards/${set.id}`} />}
                          size="sm"
                          variant="primary"
                        >
                          {t('workspace.startReview')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Chat tab ──────────────────────────────────────────────────────── */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-[600px] rounded-2xl border border-white/5 bg-slate-900/20 overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {chatHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white mb-1.5">
                      {t('workspace.interactiveChat')}
                    </h5>
                    <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                      {t('workspace.chatDescription')}
                    </p>
                  </div>
                  {/* Suggestion chips */}
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {[
                      t('workspace.suggestionKeyPoints'),
                      t('workspace.suggestionConcepts'),
                      t('workspace.suggestionSummary'),
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => { setChatMessage(q); }}
                        className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col gap-2 max-w-[82%] ${
                      msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div
                      className={`px-4 py-3.5 rounded-2xl text-sm leading-relaxed shadow-lg ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-sm shadow-indigo-600/20'
                          : 'bg-slate-900/80 border border-white/5 text-slate-200 rounded-bl-sm backdrop-blur-lg'
                      }`}
                    >
                      {msg.role === 'user' ? msg.content : <Markdown content={msg.content} />}
                    </div>

                    {msg.references?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {msg.references.map((ref: any, rIdx: number) => {
                          const key = `${idx}-${rIdx}`;
                          const isOpen = expandedCitation === key;
                          return (
                            <button
                              key={rIdx}
                              onClick={() => setExpandedCitation(isOpen ? null : key)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                                isOpen
                                  ? 'bg-indigo-600 text-white border-indigo-500'
                                  : 'bg-slate-900 text-indigo-400 border-slate-700 hover:border-indigo-500'
                              }`}
                            >
                              📄 {t('workspace.pageCitation', { page: ref.page || 1 })}
                            </button>
                          );
                        })}
                        {msg.references.map((ref: any, rIdx: number) => {
                          const key = `${idx}-${rIdx}`;
                          if (expandedCitation !== key) return null;
                          return (
                            <div key={rIdx} className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3.5 text-xs text-slate-400 italic leading-relaxed">
                              &ldquo;{ref.text || ref.content || '...'}&rdquo;
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}

              {chatLoading && (
                <div className="self-start flex items-center gap-2.5 px-4 py-3 rounded-2xl rounded-bl-sm bg-slate-900/80 border border-white/5 text-sm text-slate-400">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span className="text-xs">{t('workspace.thinking')}</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSendChat}
              className="border-t border-white/5 p-4 bg-slate-950/30 backdrop-blur-lg flex items-center gap-3"
            >
              <Input
                placeholder={t('workspace.chatPlaceholder')}
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                className="bg-slate-900/60 border-white/10 focus:border-indigo-500 flex-1"
                disabled={chatLoading}
              />
              <Button
                type="submit"
                size="sm"
                loading={chatLoading}
                disabled={!chatMessage.trim()}
                className="shrink-0 w-10 h-10 p-0 rounded-xl"
                aria-label={t('workspace.sendMessage')}
              >
                <Send className="w-4 h-4 rtl-flip" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
