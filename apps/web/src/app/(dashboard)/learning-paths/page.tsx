'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api-client';
import { useLocale } from '../../../hooks/use-locale';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Spinner } from '../../../components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Compass,
  Plus,
  BookOpen,
  Target,
  Clock,
  ChevronRight,
  X,
  CheckCircle,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

export default function LearningPathsPage() {
  const { t, locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [paths, setPaths] = useState<any[]>([]);

  // Modal & Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState('beginner');
  const [endGoal, setEndGoal] = useState('');
  const [dailyAvailableMinutes, setDailyAvailableMinutes] = useState(30);

  const loadPaths = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>('/learning-paths');
      setPaths(data || []);
    } catch (e) {
      console.error('Failed to load learning paths', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaths();
  }, []);

  const handleCreatePath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillName.trim() || !endGoal.trim()) return;

    setGenerating(true);
    try {
      await api.post('/learning-paths', {
        skillName,
        difficultyLevel,
        endGoal,
        dailyAvailableMinutes,
      });
      setModalOpen(false);
      // Reset form
      setSkillName('');
      setDifficultyLevel('beginner');
      setEndGoal('');
      setDailyAvailableMinutes(30);
      await loadPaths();
    } catch (err: any) {
      alert(locale === 'ar' ? 'فشل إنشاء المسار: ' + (err.message || err) : 'Failed to create path: ' + (err.message || err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/40 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Compass className="w-6 h-6 text-indigo-400" />
            <span>{locale === 'ar' ? 'مسارات التعلم الذكية بالذكاء الاصطناعي' : 'Intelligent AI Learning Paths'}</span>
          </h2>
          <p className="text-xs text-slate-400">
            {locale === 'ar'
              ? 'صمم مساراً تعليمياً مخصصاً لأي مهارة تريد تعلمها من الصفر حتى الاحتراف.'
              : 'Create a custom step-by-step curriculum to master any skill from zero to hero.'}
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)} className="gradient-primary text-white font-bold cursor-pointer shrink-0">
          <Plus className="w-4 h-4 mr-1.5 rtl:ml-1.5" />
          <span>{locale === 'ar' ? 'إنشاء مسار جديد' : 'Create New Path'}</span>
        </Button>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Spinner className="w-8 h-8" />
        </div>
      ) : paths.length === 0 ? (
        <Card className="bg-slate-900/10 border border-slate-800/40 py-16 flex flex-col items-center justify-center gap-4 text-center max-w-xl mx-auto">
          <div className="bg-indigo-500/10 p-5 rounded-full text-indigo-400">
            <GraduationCap className="w-12 h-12" />
          </div>
          <div className="flex flex-col gap-2 px-6">
            <h4 className="text-lg font-bold text-white">
              {locale === 'ar' ? 'لم تنشئ أي مسار بعد' : 'No Learning Paths Yet'}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {locale === 'ar'
                ? 'ابدأ بكتابة المهارة التي ترغب بتعلمها وسيقوم الموجه الذكي بتصميم خطة دراسية متكاملة فوراً.'
                : 'Enter any skill or technology you want to learn, and the AI Planner will compile a full roadmap instantly.'}
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)} variant="primary" className="font-bold cursor-pointer mt-2">
            <span>{locale === 'ar' ? 'صمم مساري التعليمي الأول' : 'Design My First Path'}</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paths.map((path) => (
            <Link key={path.id} href={`/learning-paths/${path.id}`}>
              <Card className="h-full bg-slate-900/30 border border-slate-800/40 hover:border-slate-700/60 hover:shadow-lg hover:shadow-indigo-500/2 transition-all p-5 flex flex-col justify-between gap-5 group cursor-pointer">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <Badge variant={path.isCompleted ? 'success' : 'warning'} className="px-2 py-0.5 text-[10px] uppercase font-bold">
                      {path.isCompleted ? (locale === 'ar' ? 'مكتمل' : 'Completed') : (locale === 'ar' ? 'نشط' : 'Active')}
                    </Badge>
                    <span className="text-[10px] text-slate-400 capitalize bg-slate-950 px-2 py-0.5 rounded border border-slate-800/30 font-semibold">
                      {path.difficultyLevel}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                    {path.skillName}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {locale === 'ar' ? `الهدف: ${path.endGoal}` : `Goal: ${path.endGoal}`}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/30 pt-3.5 text-xs text-slate-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {path.dailyAvailableMinutes} {locale === 'ar' ? 'دقيقة / يوم' : 'min / day'}
                  </span>
                  <span className="flex items-center gap-1 text-indigo-400 font-bold group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform">
                    <span>{locale === 'ar' ? 'عرض المسار' : 'View Path'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl-flip" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Creator Form Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-slate-900 border-slate-800 p-6 flex flex-col gap-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => !generating && setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {generating ? (
              <div className="py-12 flex flex-col items-center justify-center gap-5 text-center">
                <div className="relative">
                  <Spinner className="w-12 h-12 border-4 border-t-indigo-500" />
                  <Sparkles className="w-5 h-5 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="flex flex-col gap-2">
                  <h4 className="text-lg font-bold text-white animate-pulse">
                    {locale === 'ar' ? 'جاري تصميم مسارك التعليمي المخصص...' : 'Designing Your Custom Learning Path...'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    {locale === 'ar'
                      ? 'يقوم الموجه التعليمي بالذكاء الاصطناعي الآن بإنشاء الدروس العملية والمشاريع المناسبة لجدولك اليومي.'
                      : 'The AI Tutor Agent is formulating Milestones, stage lessons, and practical project tasks adjusted to your schedule.'}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreatePath} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5 border-b border-slate-800/40 pb-3">
                  <h3 className="text-lg font-bold text-white">
                    {locale === 'ar' ? 'تصميم مسار تعلم بالذكاء الاصطناعي' : 'Generate AI Learning Path'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {locale === 'ar'
                      ? 'أدخل البيانات المطلوبة بدقة ليقوم الذكاء الاصطناعي بضبط الدروس والمستويات.'
                      : 'Provide your target parameters to adjust AI lesson details and curriculum depth.'}
                  </p>
                </div>

                {/* Skill Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400">
                    {locale === 'ar' ? 'المهارة المستهدفة' : 'Target Skill'}
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder={locale === 'ar' ? 'مثال: لغة بايثون، تصميم واجهات، تطوير ألعاب' : 'e.g. Python Programming, UI Design, Kubernetes'}
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    className="bg-slate-955 border-slate-800 focus:ring-indigo-500/10 text-slate-200"
                  />
                </div>

                {/* Difficulty & Daily Minutes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span id="learning-path-level-label" className="text-xs font-bold text-slate-400">
                      {locale === 'ar' ? 'مستوى البدء' : 'Starting Level'}
                    </span>
                    <Select
                      value={difficultyLevel}
                      onValueChange={(value) => value !== null && setDifficultyLevel(value)}
                    >
                      <SelectTrigger
                        aria-labelledby="learning-path-level-label"
                        className="h-[38px] w-full min-w-0 border-slate-800 bg-slate-950 px-3 py-2 text-slate-300"
                      >
                        <SelectValue>
                          {difficultyLevel === 'advanced'
                            ? locale === 'ar' ? 'متقدم' : 'Advanced'
                            : difficultyLevel === 'intermediate'
                              ? locale === 'ar' ? 'متوسط' : 'Intermediate'
                              : locale === 'ar' ? 'مبتدئ' : 'Beginner'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                        <SelectItem value="beginner">{locale === 'ar' ? 'مبتدئ' : 'Beginner'}</SelectItem>
                        <SelectItem value="intermediate">{locale === 'ar' ? 'متوسط' : 'Intermediate'}</SelectItem>
                        <SelectItem value="advanced">{locale === 'ar' ? 'متقدم' : 'Advanced'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span id="learning-path-time-label" className="text-xs font-bold text-slate-400">
                      {locale === 'ar' ? 'الدراسة اليومية المتاحة' : 'Daily Available Time'}
                    </span>
                    <Select
                      value={String(dailyAvailableMinutes)}
                      onValueChange={(value) => value !== null && setDailyAvailableMinutes(Number(value))}
                    >
                      <SelectTrigger
                        aria-labelledby="learning-path-time-label"
                        className="h-[38px] w-full min-w-0 border-slate-800 bg-slate-950 px-3 py-2 text-slate-300"
                      >
                        <SelectValue>
                          {dailyAvailableMinutes} {locale === 'ar' ? 'دقيقة / يوم' : 'min / day'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                        {[15, 30, 45, 60, 120].map((minutes) => (
                          <SelectItem key={minutes} value={String(minutes)}>
                            {minutes} {locale === 'ar' ? 'دقيقة / يوم' : 'min / day'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* End Goal */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400">
                    {locale === 'ar' ? 'الهدف النهائي من التعلم' : 'End Goal / Destination'}
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder={locale === 'ar' ? 'مثال: بناء متجر إلكتروني متكامل، الحصول على وظيفة مبرمج' : 'e.g. Build an e-commerce platform from scratch, get a job as junior developer'}
                    value={endGoal}
                    onChange={(e) => setEndGoal(e.target.value)}
                    className="flex w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-800/40 pt-4 mt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setModalOpen(false)}
                    className="border-slate-800 text-slate-400 hover:text-white cursor-pointer font-semibold"
                  >
                    <span>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</span>
                  </Button>
                  <Button type="submit" className="gradient-primary text-white font-bold cursor-pointer">
                    <Sparkles className="w-4 h-4 mr-1.5 rtl:ml-1.5" />
                    <span>{locale === 'ar' ? 'توليد المسار' : 'Generate Roadmap'}</span>
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
