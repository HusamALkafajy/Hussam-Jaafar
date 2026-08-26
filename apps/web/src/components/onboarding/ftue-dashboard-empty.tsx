'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { FilePicker } from '../ui/file-picker';
import { useFTUE } from '../../hooks/use-ftue';
import { Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { useLocale } from '../../hooks/use-locale';

export function FTUEDashboardEmpty() {
  const router = useRouter();
  const { markAsSeen } = useFTUE();
  const { t } = useLocale();

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Mark as seen so they don't see this again immediately
      markAsSeen('hasUploadedDocument');
      // Simulate backend processing and redirect to the document
      router.push('/read/doc-new-123');
    }
  };

  const handleSampleDocument = () => {
    markAsSeen('hasUploadedDocument');
    router.push('/read/mock-doc-1');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center animate-in fade-in zoom-in-95 duration-500">
      
      <div className="mb-8 p-4 bg-primary/10 text-primary rounded-full ring-8 ring-primary/5">
        <Sparkles className="w-10 h-10" />
      </div>

      <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
        {t('dashboard.emptyHero')}
      </h1>
      
      <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl">
        {t('dashboard.emptyDescription')}
      </p>

      <div className="w-full max-w-2xl mx-auto mb-8 relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-indigo-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-background rounded-xl p-2">
          <FilePicker 
            className="py-16 px-6 bg-muted/20 hover:bg-muted/40 transition-all border-primary/20 shadow-sm"
            onChange={handleUpload}
            heading={<span className="text-xl md:text-2xl font-bold">{t('dashboard.browseFiles')}</span>}
            subheading={<span className="text-base text-muted-foreground">{t('dashboard.dropFormats')}</span>}
            icon={<div className="p-4 bg-primary/10 rounded-full mb-4 text-primary"><Sparkles className="w-8 h-8" /></div>}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>{t('dashboard.privacyNotice')}</span>
        </div>
        
        <div className="hidden sm:block w-1 h-1 bg-border rounded-full"></div>

        <Button variant="link" className="text-sm px-0 text-muted-foreground hover:text-primary" onClick={handleSampleDocument}>
          {t('dashboard.samplePrompt')} <strong className="ml-1 rtl:mr-1">{t('dashboard.sampleAction')}</strong> <ArrowRight className="w-4 h-4 ml-1 rtl:mr-1 rtl:-scale-x-100" />
        </Button>
      </div>
      
    </div>
  );
}
