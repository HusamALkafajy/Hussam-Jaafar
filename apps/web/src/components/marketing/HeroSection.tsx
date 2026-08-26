'use client';

import React, { memo } from 'react';
import { useLocale } from '../../hooks/use-locale';
import { Button } from '../ui/button';
import Link from 'next/link';
import { Badge } from '../ui/badge';
import { FileText, Brain, Award, Sparkles } from 'lucide-react';

const HeroSectionComponent: React.FC = () => {
  const { t } = useLocale();

  return (
    <section className="relative flex flex-col lg:flex-row items-center gap-12 pt-8">
      {/* Content Side */}
      <div className="flex-1 flex flex-col gap-6 text-center lg:text-start z-10">
        <Badge variant="primary" className="self-center lg:self-start gap-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t('landing.heroBadge')}</span>
        </Badge>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight text-foreground">
          <span className="block">{t('landing.heroTitle')}</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
          {t('landing.heroSubtitle')}
        </p>
        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mt-2">
          <Button nativeButton={false} render={<Link href="/register" />} size="lg" className="px-8 font-bold">
            {t('landing.startFree')}
          </Button>
          <Button nativeButton={false} render={<Link href="#features" />} size="lg" variant="secondary" className="px-6">
            {t('landing.viewDemo')}
          </Button>
        </div>

        {/* Hero stats */}
        <div className="grid grid-cols-3 gap-4 border-t border-border/70 pt-8 mt-4 max-w-md mx-auto lg:mx-0">
          <div>
            <p className="text-2xl font-bold text-foreground">10K+</p>
            <p className="text-xs text-muted-foreground">{t('landing.studentsCount')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">50K+</p>
            <p className="text-xs text-muted-foreground">{t('landing.summariesCount')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">100K+</p>
            <p className="text-xs text-muted-foreground">{t('landing.examsCount')}</p>
          </div>
        </div>
      </div>

      {/* Hero Illustration */}
      <div className="flex-1 w-full flex justify-center items-center relative min-h-[300px] lg:min-h-[400px]">
        {/* Animated decorative shapes */}
        <div className="absolute w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute w-60 h-60 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-75" />

        {/* Floating interactive element mocks */}
        <div className="relative w-full max-w-md flex flex-col gap-4 z-10">
          <div className="glass p-4 rounded-xl border border-slate-700/30 flex items-center gap-3 animate-bounce [animation-duration:6s] shadow-lg">
            <div className="bg-indigo-500/10 p-2.5 rounded-lg text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-card-foreground truncate">physics_revision.pdf</p>
              <p className="text-xs text-muted-foreground">{t('landing.demoProcessed', { pages: 12 })}</p>
            </div>
            <Badge variant="success">{t('landing.demoCompleted')}</Badge>
          </div>

          <div className="glass p-4 rounded-xl border border-slate-750/30 flex flex-col gap-2 translate-x-4 animate-bounce [animation-duration:8s] delay-1000 shadow-lg">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
              <Brain className="w-4 h-4" />
              <span>{t('landing.demoTutorExplains')}</span>
            </div>
            <p className="text-sm text-card-foreground leading-relaxed font-serif">
              &quot;Newton&#39;s Second Law states that force is directly proportional to acceleration...&quot;
            </p>
          </div>

          <div className="glass p-4 rounded-xl border border-slate-700/30 flex items-center justify-between -translate-x-4 animate-bounce [animation-duration:7s] delay-500 shadow-lg">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-bold text-card-foreground">{t('landing.demoQuizGenerated')}</span>
            </div>
            <Badge variant="primary">{t('landing.demoQuestions', { count: 15 })}</Badge>
          </div>
        </div>
      </div>
    </section>
  );
};

export const HeroSection = memo(HeroSectionComponent);
