'use client';

import React, { memo } from 'react';
import Link from 'next/link';
import { useLocale } from '../../hooks/use-locale';
import { Card } from '../ui/card';
import {
  FileText,
  Brain,
  Sparkles,
  ListRestart,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';

const ServicesComponent: React.FC = () => {
  const { t } = useLocale();

  const servicesList = [
    {
      title: t('landing.featureUploadTitle'),
      desc: t('landing.featureUploadDesc'),
      icon: FileText,
      href: '/files',
      glowClass: 'hover:shadow-indigo-500/10 hover:border-indigo-500/30 group-hover:text-indigo-400',
      iconBg: 'bg-indigo-500/10 text-indigo-400',
    },
    {
      title: t('landing.featureExplainTitle'),
      desc: t('landing.featureExplainDesc'),
      icon: Brain,
      href: '/files',
      glowClass: 'hover:shadow-purple-500/10 hover:border-purple-500/30 group-hover:text-purple-400',
      iconBg: 'bg-purple-500/10 text-purple-400',
    },
    {
      title: t('landing.featureSummaryTitle'),
      desc: t('landing.featureSummaryDesc'),
      icon: Sparkles,
      href: '/files',
      glowClass: 'hover:shadow-blue-500/10 hover:border-blue-500/30 group-hover:text-blue-400',
      iconBg: 'bg-blue-500/10 text-blue-400',
    },
    {
      title: t('landing.featureExamsTitle'),
      desc: t('landing.featureExamsDesc'),
      icon: ListRestart,
      href: '/exams',
      glowClass: 'hover:shadow-amber-500/10 hover:border-amber-500/30 group-hover:text-amber-400',
      iconBg: 'bg-amber-500/10 text-amber-400',
    },
    {
      title: t('landing.featureChatTitle'),
      desc: t('landing.featureChatDesc'),
      icon: MessageSquare,
      href: '/files',
      glowClass: 'hover:shadow-rose-500/10 hover:border-rose-500/30 group-hover:text-rose-400',
      iconBg: 'bg-rose-500/10 text-rose-400',
    },
    {
      title: t('landing.featureCardsTitle'),
      desc: t('landing.featureCardsDesc'),
      icon: HelpCircle,
      href: '/flashcards',
      glowClass: 'hover:shadow-emerald-500/10 hover:border-emerald-500/30 group-hover:text-emerald-400',
      iconBg: 'bg-emerald-500/10 text-emerald-400',
    },
  ];

  return (
    <section id="features" className="flex flex-col gap-12 scroll-mt-20">
      <div className="text-center flex flex-col gap-3">
        <h2 className="text-3xl sm:text-4xl font-bold">{t('landing.featuresTitle')}</h2>
        <p className="text-slate-400 max-w-xl mx-auto">
          {t('landing.featuresSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {servicesList.map((service, index) => {
          const Icon = service.icon;
          return (
            <Link key={index} href={service.href} className="group block h-full">
              <Card className={`flex flex-col gap-4 h-full p-6 transition-all duration-300 hover:scale-[1.02] bg-slate-900/40 border-slate-800/80 cursor-pointer ${service.glowClass}`}>
                <div className={`p-3 rounded-lg self-start transition-colors duration-300 ${service.iconBg}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-white transition-colors">
                  {service.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                  {service.desc}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export const Services = memo(ServicesComponent);
