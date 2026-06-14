'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useLocale } from '../../../hooks/use-locale';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Spinner } from '../../../components/ui/spinner';
import { HelpCircle, Calendar, Sparkles, Award } from 'lucide-react';
import Link from 'next/link';

export default function FlashcardsListPage() {
  const { t, locale } = useLocale();
  const [sets, setSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSets = async () => {
    try {
      const data = await api.get<any[]>('/flashcard-sets');
      setSets(data || []);
    } catch (e) {
      console.error('Failed to load flashcard sets', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
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
            <HelpCircle className="w-7 h-7 text-indigo-400 animate-pulse" />
            <span>{locale === 'ar' ? 'بطاقات المراجعة التفاعلية' : 'Interactive Flashcards'}</span>
          </h2>
          <p className="text-sm text-slate-400">
            {locale === 'ar' ? 'تصفح وراجع بطاقات الذاكرة الذكية الخاصة بك باستخدام التكرار المتباعد لتثبيت المفاهيم.' : 'Review and flip your smart memory cards using spaced repetition to master key terminology.'}
          </p>
        </div>
      </div>

      {sets.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-4 bg-slate-900/10 border-dashed border-slate-800">
          <div className="bg-indigo-500/10 p-4 rounded-full text-indigo-400">
            <HelpCircle className="w-10 h-10" />
          </div>
          <h4 className="text-lg font-bold text-white">
            {locale === 'ar' ? 'لا توجد بطاقات بعد' : 'No Flashcards Generated Yet'}
          </h4>
          <p className="text-sm text-slate-400 max-w-sm">
            {locale === 'ar' ? 'اذهب لصفحة ملفاتي، وافتح أي مستند لإنشاء بطاقات مراجعة ذكية له.' : 'Navigate to your files and open any document to auto-generate a set of flashcards.'}
          </p>
          <Link href="/files">
            <Button className="mt-2 font-semibold">
              <span>{locale === 'ar' ? 'تصفح ملفاتي' : 'Browse My Files'}</span>
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sets.map((set) => (
            <Card key={set.id} className="p-6 bg-slate-900/10 border border-slate-800/40 hover:border-slate-700/60 transition-all flex flex-col justify-between gap-5 relative overflow-hidden group">
              {/* Background gradient decoration */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] bg-slate-850 text-slate-300 border border-slate-800 px-2.5 py-0.5 rounded-full font-semibold">
                    {locale === 'ar' ? `${set.totalCards} بطاقات` : `${set.totalCards} Cards`}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(set.createdAt).toLocaleDateString(locale)}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                  {set.title}
                </h3>

                <div className="flex flex-col gap-1.5 mt-2">
                  <div className="flex justify-between text-xs text-slate-400 font-semibold">
                    <span className="flex items-center gap-1">
                      <Award className="w-4 h-4 text-emerald-450" />
                      {locale === 'ar' ? 'الكلمات المتقنة:' : 'Mastered words:'}
                    </span>
                    <span>{set.masteredCount} / {set.totalCards}</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-350"
                      style={{ width: `${(set.masteredCount / set.totalCards) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/30 pt-4">
                <span className="text-xs text-slate-400">
                  {locale === 'ar' ? `عدد المراجعات: ${set.reviewCount}` : `Reviews: ${set.reviewCount}`}
                </span>

                <Link href={`/flashcards/${set.id}`}>
                  <Button size="sm" className="font-bold flex items-center gap-1">
                    <span>{locale === 'ar' ? 'بدء المراجعة' : 'Start Review'}</span>
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
