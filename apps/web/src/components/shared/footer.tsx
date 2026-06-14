'use client';

import React, { memo } from 'react';
import Link from 'next/link';
import { useLocale } from '../../hooks/use-locale';
import { BookOpen } from 'lucide-react';

const FooterComponent: React.FC = () => {
  const { t } = useLocale();

  return (
    <footer className="w-full glass border-t border-slate-800/40 py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="gradient-primary p-2 rounded-lg text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight gradient-text">
              {t('common.appName')}
            </span>
          </Link>
          <p className="text-sm text-slate-400 leading-relaxed">
            {t('landing.heroSubtitle')}
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-200 mb-4">{t('landing.featuresTitle')}</h4>
          <ul className="flex flex-col gap-2.5 text-sm text-slate-400">
            <li>{t('landing.featureUploadTitle')}</li>
            <li>{t('landing.featureExplainTitle')}</li>
            <li>{t('landing.featureSummaryTitle')}</li>
            <li>{t('landing.featureExamsTitle')}</li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-200 mb-4">StudyAI</h4>
          <ul className="flex flex-col gap-2.5 text-sm text-slate-400">
            <li>
              <Link href="#features" className="hover:text-white transition-colors">
                {t('landing.featuresTitle')}
              </Link>
            </li>
            <li>
              <Link href="#pricing" className="hover:text-white transition-colors">
                {t('landing.pricingTitle')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-200 mb-4">Legal</h4>
          <ul className="flex flex-col gap-2.5 text-sm text-slate-400">
            <li className="hover:text-white transition-colors cursor-pointer">Privacy Policy</li>
            <li className="hover:text-white transition-colors cursor-pointer">Terms of Service</li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/20 mt-8 pt-8 flex items-center justify-between text-xs text-slate-500">
        <p>© {new Date().getFullYear()} StudyAI. All rights reserved.</p>
        <p>Built with Google Gemini API</p>
      </div>
    </footer>
  );
};

export const Footer = memo(FooterComponent);
