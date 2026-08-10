'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from '../../hooks/use-locale';
import { BookOpen } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t } = useLocale();

  return (
    <footer className="w-full glass border-t border-border/70 py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="gradient-primary p-2 rounded-lg text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight gradient-text">
              {t('common.appName')}
            </span>
          </Link>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('landing.heroSubtitle')}
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground mb-4">{t('landing.featuresTitle')}</h4>
          <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
            <li>
              <Link href="/files" className="hover:text-foreground transition-colors">
                {t('landing.featureUploadTitle')}
              </Link>
            </li>
            <li>
              <Link href="/files" className="hover:text-foreground transition-colors">
                {t('landing.featureExplainTitle')}
              </Link>
            </li>
            <li>
              <Link href="/files" className="hover:text-foreground transition-colors">
                {t('landing.featureSummaryTitle')}
              </Link>
            </li>
            <li>
              <Link href="/exams" className="hover:text-foreground transition-colors">
                {t('landing.featureExamsTitle')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground mb-4">StudyAI</h4>
          <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
            <li>
              <Link href="#features" className="hover:text-foreground transition-colors">
                {t('landing.featuresTitle')}
              </Link>
            </li>
            <li>
              <Link href="#pricing" className="hover:text-foreground transition-colors">
                {t('landing.pricingTitle')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground mb-4">{t('landing.legal')}</h4>
          <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
            <li className="hover:text-foreground transition-colors cursor-pointer">{t('landing.privacyPolicy')}</li>
            <li className="hover:text-foreground transition-colors cursor-pointer">{t('landing.termsOfService')}</li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-border/50 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <p>{t('landing.rightsReserved', { year: new Date().getFullYear() })}</p>
        <p>{t('landing.poweredBy')}</p>
      </div>
    </footer>
  );
};
