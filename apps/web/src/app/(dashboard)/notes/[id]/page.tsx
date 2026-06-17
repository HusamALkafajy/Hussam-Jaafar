'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  Save,
  Pin,
  PinOff,
  Palette,
  Loader2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  FileQuestion,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { useLocale } from '../../../../hooks/use-locale';
import { api } from '../../../../lib/api';

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  aiSummary: string | null;
  quizQuestions: Array<{ question: string; answer: string; type: 'mcq' | 'short' }> | null;
  lastAnalyzedAt: string | null;
  fileId: string | null;
  updatedAt: string;
}

const COLORS = ['default', 'red', 'green', 'blue', 'yellow', 'purple'] as const;
const COLOR_LABELS: Record<string, string> = {
  default: '#64748b', red: '#f43f5e', green: '#10b981',
  blue: '#6366f1', yellow: '#f59e0b', purple: '#a855f7',
};

export default function NoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const noteId = params.id as string;
  const { locale } = useLocale();
  const isRtl = locale === 'ar';

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [showPalette, setShowPalette] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [quizOpen, setQuizOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load note
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<Note>(`/notes/${noteId}`);
        setNote(data);
        setTitle(data.title);
        setContent(data.content);
      } catch { router.push('/notes'); }
      finally { setLoading(false); }
    })();
  }, [noteId, router]);

  // Auto-save with debounce (title and content only — no AI trigger)
  const triggerSave = useCallback((newTitle: string, newContent: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.patch(`/notes/${noteId}`, { title: newTitle, content: newContent });
        setSavedAt(new Date().toLocaleTimeString());
      } catch { /* silent */ }
      finally { setSaving(false); }
    }, 800);
  }, [noteId]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    triggerSave(e.target.value, content);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    triggerSave(title, e.target.value);
  };

  const handleColorChange = async (color: string) => {
    setShowPalette(false);
    setNote((n) => n ? { ...n, color } : n);
    await api.patch(`/notes/${noteId}`, { color });
  };

  const handlePin = async () => {
    if (!note) return;
    const newPin = !note.isPinned;
    setNote((n) => n ? { ...n, isPinned: newPin } : n);
    await api.patch(`/notes/${noteId}`, { isPinned: newPin });
  };

  /** Manual AI analysis — only triggered by user button click */
  const handleAnalyze = async () => {
    if (!content || content.trim().length < 20) {
      setError(isRtl ? 'أضف محتوى أكثر قبل التحليل (20 حرفًا على الأقل)' : 'Add more content before analyzing (at least 20 chars)');
      return;
    }
    setError('');
    setAnalyzing(true);
    try {
      const updated = await api.post<Note>(`/notes/${noteId}/analyze`);
      setNote(updated);
      setSummaryOpen(true);
      setQuizOpen(true);
    } catch (err: any) {
      setError(err.message || (isRtl ? 'فشل التحليل' : 'Analysis failed'));
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!note) return null;

  const accentColor = COLOR_LABELS[note.color] || COLOR_LABELS.default;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/notes')}
          className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1" />
        {/* Save indicator */}
        <span className="text-xs text-slate-600 flex items-center gap-1">
          {saving ? (
            <><Loader2 className="w-3 h-3 animate-spin text-indigo-400" />{isRtl ? 'جاري الحفظ...' : 'Saving...'}</>
          ) : savedAt ? (
            <><Save className="w-3 h-3 text-emerald-400" />{isRtl ? `حُفظ ${savedAt}` : `Saved at ${savedAt}`}</>
          ) : null}
        </span>
        {/* Color palette */}
        <div className="relative">
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition"
            title="Change color"
          >
            <Palette className="w-4 h-4" style={{ color: accentColor }} />
          </button>
          {showPalette && (
            <div className="absolute top-10 right-0 z-20 bg-slate-900 border border-slate-700/50 rounded-xl p-3 flex gap-2 shadow-xl">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => handleColorChange(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${note.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: COLOR_LABELS[c] }}
                />
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handlePin}
          className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-indigo-400 transition"
          title={note.isPinned ? 'Unpin' : 'Pin'}
        >
          {note.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
        </button>
        {/* AI Analyze button */}
        <Button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg shadow-indigo-500/20 hover:opacity-90 transition disabled:opacity-50"
        >
          {analyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {analyzing
            ? (isRtl ? 'جاري التحليل...' : 'Analyzing...')
            : (isRtl ? 'تحليل ذكي' : 'AI Analyze')}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Note editor */}
      <div
        className="glass rounded-2xl border p-6 mb-6"
        style={{ borderColor: `${accentColor}30` }}
      >
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder={isRtl ? 'عنوان الملاحظة...' : 'Note title...'}
          className="w-full text-2xl font-bold text-white bg-transparent border-none outline-none placeholder-slate-600 mb-4"
          dir={isRtl ? 'rtl' : 'ltr'}
        />
        <div className="w-full h-px bg-slate-800/60 mb-4" />
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder={isRtl
            ? 'ابدأ الكتابة هنا... يدعم Markdown.\n\nبعد الانتهاء، اضغط "تحليل ذكي" لتوليد ملخص وأسئلة تدريبية من ملاحظاتك.'
            : 'Start writing here... Markdown supported.\n\nWhen done, click "AI Analyze" to generate a summary and quiz questions from your notes.'}
          className="w-full min-h-[320px] bg-transparent text-slate-300 text-sm leading-relaxed outline-none resize-none placeholder-slate-600 font-mono"
          dir={isRtl ? 'rtl' : 'ltr'}
        />
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/40 text-xs text-slate-600">
          <span>{content.length} {isRtl ? 'حرف' : 'chars'}</span>
          {note.lastAnalyzedAt && (
            <span className="flex items-center gap-1 text-indigo-400/70">
              <Sparkles className="w-3 h-3" />
              {isRtl ? 'آخر تحليل:' : 'Last analyzed:'} {new Date(note.lastAnalyzedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* AI Results */}
      {(note.aiSummary || note.quizQuestions?.length) ? (
        <div className="space-y-4">
          {/* Summary */}
          {note.aiSummary && (
            <div className="bg-slate-900/40 rounded-2xl border border-indigo-500/10 overflow-hidden">
              <div
                className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-indigo-300 hover:bg-indigo-500/5 transition cursor-pointer"
                onClick={() => setSummaryOpen(!summaryOpen)}
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  {isRtl ? 'الملخص الذكي' : 'AI Summary'}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleCopy(note.aiSummary!, e)}
                    className="p-1.5 rounded-md hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition"
                    title={isRtl ? 'نسخ' : 'Copy'}
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  {summaryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
              {summaryOpen && (
                <div className="px-5 pb-4 text-sm text-slate-300 leading-relaxed border-t border-indigo-500/10 pt-3">
                  {note.aiSummary}
                </div>
              )}
            </div>
          )}

          {/* Quiz Questions */}
          {note.quizQuestions && note.quizQuestions.length > 0 && (
            <div className="bg-slate-900/40 rounded-2xl border border-purple-500/10 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-purple-300 hover:bg-purple-500/5 transition"
                onClick={() => setQuizOpen(!quizOpen)}
              >
                <span className="flex items-center gap-2">
                  <FileQuestion className="w-4 h-4" />
                  {isRtl ? `أسئلة تدريبية (${note.quizQuestions.length})` : `Quiz Questions (${note.quizQuestions.length})`}
                </span>
                {quizOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {quizOpen && (
                <div className="px-5 pb-4 border-t border-purple-500/10 pt-3 space-y-4">
                  {note.quizQuestions.map((q, i) => (
                    <QuizCard key={i} question={q} index={i} isRtl={isRtl} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="glass rounded-2xl border border-dashed border-slate-700/50 p-8 text-center">
          <Sparkles className="w-8 h-8 text-indigo-400/40 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {isRtl
              ? 'اضغط "تحليل ذكي" بعد كتابة ملاحظاتك لتوليد ملخص وأسئلة تدريبية'
              : 'Click "AI Analyze" after writing your notes to generate a summary and quiz questions'}
          </p>
        </div>
      )}
    </div>
  );
}

function QuizCard({
  question,
  index,
  isRtl,
}: {
  question: { question: string; answer: string; type: 'mcq' | 'short' };
  index: number;
  isRtl: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="bg-slate-800/40 rounded-xl p-4">
      <div className="flex items-start gap-3 mb-2">
        <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1">
          <span className="text-[10px] uppercase tracking-wider text-purple-400/70 font-semibold">
            {question.type === 'mcq' ? (isRtl ? 'اختيار متعدد' : 'MCQ') : (isRtl ? 'إجابة قصيرة' : 'Short Answer')}
          </span>
          <p className="text-sm text-slate-200 mt-0.5">{question.question}</p>
        </div>
      </div>
      {revealed ? (
        <div className="mt-2 pt-2 border-t border-slate-700/40">
          <p className="text-xs text-emerald-400 font-semibold mb-0.5">{isRtl ? 'الإجابة:' : 'Answer:'}</p>
          <p className="text-sm text-slate-300">{question.answer}</p>
        </div>
      ) : (
        <button
          onClick={() => setRevealed(true)}
          className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition font-medium"
        >
          {isRtl ? 'إظهار الإجابة' : 'Reveal Answer'}
        </button>
      )}
    </div>
  );
}
