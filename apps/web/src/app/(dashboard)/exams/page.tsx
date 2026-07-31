'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useLocale } from '../../../hooks/use-locale';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Spinner } from '../../../components/ui/spinner';
import { GraduationCap, Calendar, HelpCircle, FileText, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function ExamsListPage() {
  const { t, locale } = useLocale();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = async () => {
    try {
      const data = await api.get<any[]>('/exams');
      setExams(data || []);
    } catch (e) {
      console.error('Failed to load exams', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-800/40 pb-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-indigo-400 animate-pulse" />
            <span>{t('exams.title')}</span>
          </h2>
          <p className="text-sm text-slate-400">
            {t('exams.description')}
          </p>
        </div>
      </div>

      {exams.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-4 bg-slate-900/10 border-dashed border-slate-800">
          <div className="bg-indigo-500/10 p-4 rounded-full text-indigo-400">
            <GraduationCap className="w-10 h-10" />
          </div>
          <h4 className="text-lg font-bold text-white">
            {t('exams.emptyTitle')}
          </h4>
          <p className="text-sm text-slate-400 max-w-sm">
            {t('exams.emptyDescription')}
          </p>
          <Button
            nativeButton={false}
            render={<Link href="/files" />}
            className="mt-2 font-semibold"
          >
            <span>{t('exams.browseFiles')}</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {exams.map((ex) => (
            <Card key={ex.id} className="p-6 bg-slate-900/10 border border-slate-800/40 hover:border-slate-700/60 transition-all flex flex-col justify-between gap-5 relative overflow-hidden group">
              {/* Background gradient decoration */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] bg-indigo-500/15 text-indigo-400 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    {t('exams.difficulty', { difficulty: ex.difficulty })}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(ex.createdAt).toLocaleDateString(locale)}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                  {ex.title}
                </h3>

                <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <HelpCircle className="w-4 h-4 text-slate-500" />
                    {t('exams.questions', { count: ex.totalQuestions })}
                  </span>
                  {ex.timeLimitMinutes && (
                    <span>
                      {t('exams.timeLimit', { minutes: ex.timeLimitMinutes })}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/30 pt-4 mt-1">
                {ex.status === 'completed' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{t('exams.score')}</span>
                    <span className={`text-base font-extrabold ${Number(ex.score) >= 70 ? 'text-emerald-450' : 'text-amber-450'}`}>
                      {ex.score}%
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                    {t('exams.inProgress')}
                  </span>
                )}

                <Button
                  nativeButton={false}
                  render={<Link href={`/exams/${ex.id}`} />}
                  size="sm"
                  variant={ex.status === 'completed' ? 'secondary' : 'primary'}
                  className="font-bold flex items-center gap-1"
                >
                  <span>
                    {ex.status === 'completed' ? t('exams.viewResults') : t('exams.start')}
                  </span>
                  <ChevronRight className="w-4 h-4 rtl-flip shrink-0" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
