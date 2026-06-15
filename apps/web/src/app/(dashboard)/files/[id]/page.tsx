'use client';

import React, { useEffect, useState, use } from 'react';
import { api } from '../../../../lib/api';
import { useLocale } from '../../../../hooks/use-locale';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Spinner } from '../../../../components/ui/spinner';
import { Input } from '../../../../components/ui/input';
import {
  FileText,
  Brain,
  ListRestart,
  HelpCircle,
  MessageSquare,
  Sparkles,
  ArrowLeft,
  Calendar,
  Layers,
  FileCheck,
  Send,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatBytes, formatDate } from '../../../../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function FileDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const fileId = resolvedParams.id;
  const { t, locale } = useLocale();

  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [file, setFile] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'summary' | 'explain' | 'quiz' | 'flashcards' | 'chat'>('content');

  // AI Summary Tab State
  const [summaryLevel, setSummaryLevel] = useState<'short' | 'medium' | 'comprehensive'>('medium');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryResult, setSummaryResult] = useState<any | null>(null);

  // AI Explain Tab State
  const [explainLevel, setExplainLevel] = useState<'simple' | 'intermediate' | 'academic'>('intermediate');
  const [generatingExplain, setGeneratingExplain] = useState(false);
  const [explainResult, setExplainResult] = useState<any | null>(null);

  // AI Chat Tab State
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string; references?: any }>>([]);
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);

  // AI Exam Tab State
  const router = useRouter();
  const [examDifficulty, setExamDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [examTotalQuestions, setExamTotalQuestions] = useState<number>(10);
  const [examQuestionTypes, setExamQuestionTypes] = useState<string[]>(['mcq', 'true_false']);
  const [generatingExam, setGeneratingExam] = useState(false);
  const [previousExams, setPreviousExams] = useState<any[]>([]);

  // AI Flashcards Tab State
  const [flashcardsCount, setFlashcardsCount] = useState<number>(10);
  const [flashcardSetTitle, setFlashcardSetTitle] = useState<string>('');
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [previousSets, setPreviousSets] = useState<any[]>([]);

  const loadFile = async () => {
    setLoading(true);
    try {
      const data = await api.get<any>(`/files/${fileId}`);
      setFile(data);
    } catch (e) {
      console.error('Failed to load file details', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      await api.post(`/files/${fileId}/reprocess`);
      await loadFile();
    } catch (err: any) {
      alert(locale === 'ar' ? 'فشلت إعادة محاولة التحليل: ' + (err.message || err) : 'Failed to retry analysis: ' + (err.message || err));
    } finally {
      setReprocessing(false);
    }
  };

  const loadExamsAndSets = async () => {
    try {
      const [examsData, setsData] = await Promise.all([
        api.get<any[]>('/exams'),
        api.get<any[]>('/flashcard-sets'),
      ]);
      setPreviousExams((examsData || []).filter((e: any) => e.fileId === fileId));
      setPreviousSets((setsData || []).filter((s: any) => s.fileId === fileId));
    } catch (e) {
      console.error('Failed to load history', e);
    }
  };

  useEffect(() => {
    loadFile();
    loadExamsAndSets();
  }, [fileId]);

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const result = await api.post<any>(`/files/${fileId}/summary`, {
        level: summaryLevel,
        language: locale,
      });
      setSummaryResult(result);
    } catch (e) {
      alert('Failed to generate summary');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleGenerateExplanation = async () => {
    setGeneratingExplain(true);
    try {
      const result = await api.post<any>(`/files/${fileId}/explain`, {
        level: explainLevel,
        language: locale,
      });
      setExplainResult(result);
    } catch (e) {
      alert('Failed to generate explanation');
    } finally {
      setGeneratingExplain(false);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg = chatMessage;
    setChatMessage('');
    setChatHistory((prev) => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const result = await api.post<any>(`/files/${fileId}/chat`, {
        content: userMsg,
      });
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: result.content, references: result.references },
      ]);
    } catch (err) {
      alert('Failed to send message');
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateExam = async () => {
    setGeneratingExam(true);
    try {
      const exam = await api.post<any>('/exams', {
        fileId,
        difficulty: examDifficulty,
        totalQuestions: examTotalQuestions,
        questionTypes: examQuestionTypes,
      }, { timeout: 15 * 60 * 1000 });
      router.push(`/exams/${exam.id}`);
    } catch (e: any) {
      alert('Failed to generate exam: ' + (e.message || e));
    } finally {
      setGeneratingExam(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    setGeneratingFlashcards(true);
    try {
      const set = await api.post<any>('/flashcard-sets', {
        fileId,
        title: flashcardSetTitle.trim() || undefined,
        count: flashcardsCount,
      });
      router.push(`/flashcards/${set.id}`);
    } catch (e: any) {
      alert('Failed to generate flashcards: ' + (e.message || e));
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="text-center py-10 flex flex-col items-center gap-3">
        <p className="text-slate-400">File not found or access denied.</p>
        <Link href="/files">
          <Button>Back to Files</Button>
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'content', label: t('files.tabContent'), icon: FileText },
    { id: 'summary', label: t('files.tabSummary'), icon: Sparkles },
    { id: 'explain', label: t('files.tabExplain'), icon: Brain },
    { id: 'quiz', label: t('files.tabExam'), icon: ListRestart },
    { id: 'flashcards', label: t('files.tabFlashcards'), icon: HelpCircle },
    { id: 'chat', label: t('files.tabChat'), icon: MessageSquare },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      {/* File Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-805/20 pb-6">
        <div className="flex items-start gap-4">
          <Link href="/files" className="mt-1 p-2 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4 rtl-flip" />
          </Link>
          <div className="flex flex-col gap-2 min-w-0">
            <h2 className="text-2xl font-bold text-white truncate max-w-[400px]">
              {file.originalName}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(file.createdAt, locale)}
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                {formatBytes(file.fileSize)}
              </span>
              <span className="flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5" />
                <span className="capitalize">{file.fileType}</span>
              </span>
            </div>
          </div>
        </div>

        <Badge
          variant={
            file.processingStatus === 'completed'
              ? 'success'
              : file.processingStatus === 'failed'
              ? 'danger'
              : 'warning'
          }
          className="self-start md:self-center px-4 py-1"
        >
          {file.processingStatus === 'completed'
            ? t('files.statusCompleted')
            : file.processingStatus === 'failed'
            ? t('files.statusFailed')
            : t('files.statusProcessing')}
        </Badge>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-800 overflow-x-auto gap-2 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="mt-2 min-h-[300px]">
        {/* Content Tab */}
        {activeTab === 'content' && (
          <Card className="bg-slate-900/10 p-6 leading-relaxed text-slate-200">
            {file.processingStatus === 'completed' ? (
              <div className="whitespace-pre-wrap font-serif text-base max-w-3xl mx-auto">
                {file.extractedText}
              </div>
            ) : file.processingStatus === 'failed' ? (
              <div className="py-12 flex flex-col items-center justify-center gap-5 max-w-md mx-auto text-center">
                <div className="bg-rose-500/10 p-4 rounded-full text-rose-400 animate-pulse">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                <div className="flex flex-col gap-2">
                  <h4 className="text-base font-bold text-white">
                    {locale === 'ar' ? 'فشل تحليل المستند' : 'Document Analysis Failed'}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {locale === 'ar'
                      ? 'حدث خطأ أثناء استخراج وتجهيز محتوى الملف. يرجى المحاولة مرة أخرى.'
                      : 'An error occurred while extracting and processing document content. Please try again.'}
                  </p>
                  {file.processingError && (
                    <p className="bg-rose-950/20 border border-rose-900/30 p-3 rounded-lg font-mono text-[11px] text-rose-400 mt-2 text-left rtl:text-right break-words max-w-full leading-normal">
                      {file.processingError}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleReprocess}
                  loading={reprocessing}
                  className="mt-2 bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  <span>{locale === 'ar' ? 'إعادة محاولة التحليل' : 'Retry Analysis'}</span>
                </Button>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center gap-4">
                <Spinner className="w-8 h-8" />
                <p className="text-sm text-slate-400">
                  Document processing is in progress. Check back in a few moments.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="flex flex-col gap-6">
            <Card className="p-6 bg-slate-900/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h4 className="text-base font-bold text-white">توليد ملخص ذكي بالذكاء الاصطناعي</h4>
                  <p className="text-xs text-slate-400">اختر مستوى التفصيل الذي تفضله للملخص.</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={summaryLevel}
                    onChange={(e: any) => setSummaryLevel(e.target.value)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="short">ملخص قصير</option>
                    <option value="medium">ملخص متوسط</option>
                    <option value="comprehensive">ملخص شامل</option>
                  </select>
                  <Button onClick={handleGenerateSummary} loading={generatingSummary} size="sm" className="font-bold">
                    <span>تلخيص</span>
                  </Button>
                </div>
              </div>
            </Card>

            {summaryResult && (
              <div className="flex flex-col gap-6">
                {/* Main Summary */}
                <Card className="p-6 bg-slate-900/10 leading-relaxed font-serif">
                  <h3 className="text-lg font-bold text-white mb-4">الملخص</h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-slate-200">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {summaryResult.content}
                    </ReactMarkdown>
                  </div>
                </Card>

                {/* Key Points */}
                {summaryResult.keyPoints && summaryResult.keyPoints.length > 0 && (
                  <Card className="p-6 bg-slate-900/10">
                    <h3 className="text-lg font-bold text-white mb-4">النقاط المهمة</h3>
                    <ul className="list-disc list-inside flex flex-col gap-2 text-slate-300 text-sm">
                      {summaryResult.keyPoints.map((point: string, idx: number) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Definitions & Laws */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {summaryResult.definitions && summaryResult.definitions.length > 0 && (
                    <Card className="p-6 bg-slate-900/10 flex flex-col gap-4">
                      <h3 className="text-base font-bold text-white">التعاريف</h3>
                      <div className="flex flex-col gap-3">
                        {summaryResult.definitions.map((def: any, idx: number) => (
                          <div key={idx} className="bg-slate-900/30 border border-slate-800/40 p-3 rounded-lg text-sm">
                            <span className="font-bold text-indigo-400 block mb-1">{def.term}</span>
                            <span className="text-slate-300">{def.definition}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {summaryResult.lawsFormulas && summaryResult.lawsFormulas.length > 0 && (
                    <Card className="p-6 bg-slate-900/10 flex flex-col gap-4">
                      <h3 className="text-base font-bold text-white">القوانين والمعادلات</h3>
                      <div className="flex flex-col gap-3">
                        {summaryResult.lawsFormulas.map((law: any, idx: number) => (
                          <div key={idx} className="bg-slate-900/30 border border-slate-800/40 p-3 rounded-lg text-sm">
                            <span className="font-bold text-indigo-400 block mb-1">{law.name}</span>
                            <code className="block bg-slate-950 p-2 rounded text-indigo-300 font-mono text-center my-1.5">{law.formula}</code>
                            {law.explanation && <span className="text-slate-400 text-xs">{law.explanation}</span>}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Explain Tab */}
        {activeTab === 'explain' && (
          <div className="flex flex-col gap-6">
            <Card className="p-6 bg-slate-900/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h4 className="text-base font-bold text-white">شرح تفاعلي بالذكاء الاصطناعي</h4>
                  <p className="text-xs text-slate-400">اختر مستوى الشرح المناسب لقدراتك الدراسية.</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={explainLevel}
                    onChange={(e: any) => setExplainLevel(e.target.value)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="simple">شرح مبسط</option>
                    <option value="intermediate">شرح متوسط</option>
                    <option value="academic">شرح أكاديمي</option>
                  </select>
                  <Button onClick={handleGenerateExplanation} loading={generatingExplain} size="sm" className="font-bold">
                    <span>اشرح لي</span>
                  </Button>
                </div>
              </div>
            </Card>

            {generatingExplain && !explainResult && (
              <Card className="p-6 bg-slate-900/20 border border-slate-800/60 text-slate-300 flex items-center gap-3">
                <Spinner className="w-5 h-5 text-indigo-400 animate-spin" />
                <div>
                  <p className="text-sm font-semibold text-white">Still generating your explanation...</p>
                  <p className="text-xs text-slate-400">Academic explanations can take longer to create. Please keep this page open.</p>
                </div>
              </Card>
            )}

            {explainResult && (
              <div className="flex flex-col gap-6">
                {/* Main Explanation */}
                <Card className="p-6 bg-slate-900/10 leading-relaxed font-serif">
                  <h3 className="text-lg font-bold text-white mb-4">الشرح والتوضيح</h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-slate-200">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {explainResult.content}
                    </ReactMarkdown>
                  </div>
                </Card>

                {/* Practical Examples */}
                {explainResult.examples && explainResult.examples.length > 0 && (
                  <Card className="p-6 bg-slate-900/10">
                    <h3 className="text-lg font-bold text-white mb-4">أمثلة توضيحية</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {explainResult.examples.map((ex: string, idx: number) => (
                        <div key={idx} className="border border-indigo-500/10 bg-indigo-500/5 p-4 rounded-xl text-sm text-indigo-200">
                          {ex}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Comprehension Questions */}
                {explainResult.comprehensionQuestions && explainResult.comprehensionQuestions.length > 0 && (
                  <Card className="p-6 bg-slate-900/10">
                    <h3 className="text-lg font-bold text-white mb-4">أسئلة فهم وقياس مستوى</h3>
                    <div className="flex flex-col gap-4">
                      {explainResult.comprehensionQuestions.map((q: any, idx: number) => (
                        <div key={idx} className="bg-slate-900/20 border border-slate-850 p-4 rounded-xl flex flex-col gap-2">
                          <p className="text-sm font-bold text-slate-200 flex items-center gap-2">
                            <HelpCircle className="w-4.5 h-4.5 text-indigo-400" />
                            <span>{q.question}</span>
                          </p>
                          <details className="text-xs text-indigo-400 cursor-pointer font-medium mt-1">
                            <summary className="hover:text-indigo-300">عرض الإجابة النموذجية</summary>
                            <p className="text-slate-350 leading-relaxed p-3 bg-slate-950/40 rounded-lg border border-slate-900 mt-2">
                              {q.answer}
                            </p>
                          </details>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quiz Tab */}
        {activeTab === 'quiz' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <Card className="p-6 bg-slate-900/30 border border-slate-800/60">
              <h4 className="text-base font-bold text-white mb-4">
                {locale === 'ar' ? 'توليد اختبار ذكي بالذكاء الاصطناعي' : 'Generate Smart Exam with AI'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Difficulty */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400">
                    {locale === 'ar' ? 'مستوى الصعوبة' : 'Difficulty Level'}
                  </label>
                  <select
                    value={examDifficulty}
                    onChange={(e: any) => setExamDifficulty(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-350 focus:outline-none focus:border-indigo-500 w-full"
                  >
                    <option value="easy">{locale === 'ar' ? 'سهل' : 'Easy'}</option>
                    <option value="medium">{locale === 'ar' ? 'متوسط' : 'Medium'}</option>
                    <option value="hard">{locale === 'ar' ? 'صعب' : 'Hard'}</option>
                  </select>
                </div>

                {/* Question Count */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400">
                    {locale === 'ar' ? 'عدد الأسئلة' : 'Number of Questions'}
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={examTotalQuestions}
                    onChange={(e: any) => setExamTotalQuestions(Number(e.target.value))}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-350 focus:outline-none focus:border-indigo-500 w-full"
                  />
                </div>

                {/* Question Types */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400">
                    {locale === 'ar' ? 'أنواع الأسئلة' : 'Question Types'}
                  </label>
                  <div className="flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={examQuestionTypes.includes('mcq')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setExamQuestionTypes([...examQuestionTypes, 'mcq']);
                          } else {
                            setExamQuestionTypes(examQuestionTypes.filter((t) => t !== 'mcq'));
                          }
                        }}
                        className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{locale === 'ar' ? 'اختيار من متعدد' : 'MCQ'}</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={examQuestionTypes.includes('true_false')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setExamQuestionTypes([...examQuestionTypes, 'true_false']);
                          } else {
                            setExamQuestionTypes(examQuestionTypes.filter((t) => t !== 'true_false'));
                          }
                        }}
                        className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{locale === 'ar' ? 'صح أو خطأ' : 'True/False'}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-800/40 pt-4">
                <Button
                  onClick={handleGenerateExam}
                  loading={generatingExam}
                  disabled={examQuestionTypes.length === 0 || examTotalQuestions < 5}
                  className="font-bold cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  <span>{locale === 'ar' ? 'توليد الاختبار' : 'Generate Exam'}</span>
                </Button>
              </div>
            </Card>

            {/* Previous Exams */}
            {previousExams.length > 0 && (
              <div className="flex flex-col gap-4 mt-2">
                <h5 className="text-sm font-bold text-white">
                  {locale === 'ar' ? 'الاختبارات السابقة لهذا المستند' : 'Previous Quizzes for this Document'}
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {previousExams.map((ex) => (
                    <Card key={ex.id} className="p-4 bg-slate-900/30 border border-slate-800/40 hover:border-slate-700/60 transition-all flex flex-col justify-between gap-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-bold uppercase">{ex.difficulty}</span>
                          <span className="text-xs text-slate-400">{new Date(ex.createdAt).toLocaleDateString(locale)}</span>
                        </div>
                        <h6 className="text-sm font-bold text-white line-clamp-1">{ex.title}</h6>
                        <p className="text-xs text-slate-400">
                          {locale === 'ar' ? `عدد الأسئلة: ${ex.totalQuestions}` : `Questions: ${ex.totalQuestions}`}
                        </p>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-800/30 pt-3">
                        {ex.status === 'completed' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{locale === 'ar' ? 'الدرجة:' : 'Score:'}</span>
                            <span className={`text-sm font-bold ${Number(ex.score) >= 70 ? 'text-emerald-400' : 'text-amber-450'}`}>{ex.score}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-500 font-semibold">{locale === 'ar' ? 'غير مكتمل' : 'In Progress'}</span>
                        )}
                        <Link href={`/exams/${ex.id}`}>
                          <Button size="sm" variant={ex.status === 'completed' ? 'secondary' : 'primary'}>
                            <span>{ex.status === 'completed' ? (locale === 'ar' ? 'عرض النتائج' : 'View Results') : (locale === 'ar' ? 'حل الاختبار' : 'Take Exam')}</span>
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Flashcards Tab */}
        {activeTab === 'flashcards' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <Card className="p-6 bg-slate-900/30 border border-slate-800/60">
              <h4 className="text-base font-bold text-white mb-4">
                {locale === 'ar' ? 'توليد بطاقات مراجعة ذكية' : 'Generate Smart Flashcard Set'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Title */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400">
                    {locale === 'ar' ? 'عنوان المجموعة (اختياري)' : 'Set Title (Optional)'}
                  </label>
                  <Input
                    type="text"
                    placeholder={locale === 'ar' ? 'مثال: مفاهيم الفصل الأول' : 'e.g. Chapter 1 Concepts'}
                    value={flashcardSetTitle}
                    onChange={(e) => setFlashcardSetTitle(e.target.value)}
                    className="bg-slate-900 border-slate-800 focus:ring-indigo-500/10 text-slate-200"
                  />
                </div>

                {/* Card Count */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400">
                    {locale === 'ar' ? 'عدد البطاقات' : 'Number of Cards'}
                  </label>
                  <select
                    value={flashcardsCount}
                    onChange={(e: any) => setFlashcardsCount(Number(e.target.value))}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-350 focus:outline-none focus:border-indigo-500 w-full h-[38px]"
                  >
                    <option value={5}>5 {locale === 'ar' ? 'بطاقات' : 'Cards'}</option>
                    <option value={10}>10 {locale === 'ar' ? 'بطاقات' : 'Cards'}</option>
                    <option value={15}>15 {locale === 'ar' ? 'بطاقة' : 'Cards'}</option>
                    <option value={20}>20 {locale === 'ar' ? 'بطاقة' : 'Cards'}</option>
                    <option value={30}>30 {locale === 'ar' ? 'بطاقة' : 'Cards'}</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-800/40 pt-4">
                <Button
                  onClick={handleGenerateFlashcards}
                  loading={generatingFlashcards}
                  className="font-bold cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  <span>{locale === 'ar' ? 'توليد البطاقات' : 'Generate Cards'}</span>
                </Button>
              </div>
            </Card>

            {/* Previous sets list */}
            {previousSets.length > 0 && (
              <div className="flex flex-col gap-4 mt-2">
                <h5 className="text-sm font-bold text-white">
                  {locale === 'ar' ? 'مجموعات البطاقات السابقة لهذا المستند' : 'Previous Flashcard Sets for this Document'}
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {previousSets.map((set) => (
                    <Card key={set.id} className="p-4 bg-slate-900/30 border border-slate-800/40 hover:border-slate-700/60 transition-all flex flex-col justify-between gap-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">{new Date(set.createdAt).toLocaleDateString(locale)}</span>
                        </div>
                        <h6 className="text-sm font-bold text-white line-clamp-1">{set.title}</h6>
                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>{locale === 'ar' ? 'مستوى الإتقان' : 'Mastery Progress'}</span>
                            <span>{set.masteredCount} / {set.totalCards}</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-900">
                            <div
                              className="bg-emerald-500 h-full transition-all duration-300"
                              style={{ width: `${(set.masteredCount / set.totalCards) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-800/30 pt-3">
                        <span className="text-xs text-slate-400">
                          {locale === 'ar' ? `المراجعات: ${set.reviewCount}` : `Reviews: ${set.reviewCount}`}
                        </span>
                        <Link href={`/flashcards/${set.id}`}>
                          <Button size="sm" variant="primary">
                            <span>{locale === 'ar' ? 'بدء المراجعة' : 'Start Review'}</span>
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <Card className="flex flex-col h-[500px] bg-slate-900/10 p-0 border border-slate-800/40 rounded-xl overflow-hidden">
            {/* Messages body */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {chatHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center my-auto">
                  <MessageSquare className="w-12 h-12 text-slate-650 animate-bounce" />
                  <h5 className="text-sm font-semibold text-slate-350">الدردشة التفاعلية مع الملف</h5>
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                    اطرح أي سؤال حول محتويات هذا المستند، وسيجيبك المساعد التعليمي بالإشارة للمرجع والصفحة.
                  </p>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col gap-1.5 max-w-[80%] ${
                      msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div
                      className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/10'
                          : 'bg-slate-900/80 border border-slate-800/60 text-slate-200 rounded-bl-none prose prose-sm dark:prose-invert max-w-none'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        msg.content
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>

                    {msg.references && msg.references.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase">
                          <span>{locale === 'ar' ? 'المراجع الدراسية:' : 'Sources / Citations:'}</span>
                          {msg.references.map((ref: any, rIdx: number) => {
                            const citationKey = `${idx}-${rIdx}`;
                            const isExpanded = expandedCitation === citationKey;
                            return (
                              <button
                                key={rIdx}
                                type="button"
                                onClick={() => setExpandedCitation(isExpanded ? null : citationKey)}
                                className={`px-2 py-0.5 rounded cursor-pointer transition-all border font-mono text-[9px] ${
                                  isExpanded
                                    ? 'bg-indigo-500 text-white border-indigo-400 font-bold'
                                    : 'bg-slate-900 text-indigo-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                                }`}
                              >
                                {locale === 'ar' ? `صفحة ${ref.page || ref.pageNumber || 1}` : `Page ${ref.page || ref.pageNumber || 1}`}
                              </button>
                            );
                          })}
                        </div>

                        {msg.references.map((ref: any, rIdx: number) => {
                          const citationKey = `${idx}-${rIdx}`;
                          if (expandedCitation !== citationKey) return null;
                          return (
                            <div
                              key={rIdx}
                              className="bg-slate-950/70 border border-slate-850 p-3 rounded-xl text-xs text-slate-350 font-sans italic max-w-sm mt-1 animate-fade-in"
                            >
                              &ldquo;{ref.text || ref.content || (locale === 'ar' ? 'سياق الاقتباس المتطابق في الصفحة المحددة...' : 'Matching context snippet on page...')}&rdquo;
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}

              {chatLoading && (
                <div className="self-start flex items-center gap-2 text-xs text-slate-500 font-semibold bg-slate-900/30 px-3.5 py-2.5 rounded-2xl border border-slate-850 rounded-bl-none">
                  <Spinner className="w-3.5 h-3.5 border-2" />
                  <span>المساعد يفكر...</span>
                </div>
              )}
            </div>

            {/* Message input footer */}
            <form onSubmit={handleSendChatMessage} className="border-t border-slate-800/40 p-4 bg-slate-950/20 flex items-center gap-3">
              <Input
                id="chat"
                placeholder="اسألني أي شيء عن الملف..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                className="bg-slate-900/40 border-slate-800 focus:ring-indigo-500/10"
                disabled={chatLoading}
                required
              />
              <Button type="submit" size="sm" loading={chatLoading} disabled={!chatMessage.trim()} className="shrink-0 p-3">
                <Send className="w-4 h-4 rtl-flip" />
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
