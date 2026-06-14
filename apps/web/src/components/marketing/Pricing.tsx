'use client';

import React, { memo } from 'react';
import { useLocale } from '../../hooks/use-locale';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Check } from 'lucide-react';

const PricingComponent: React.FC = () => {
  const { t } = useLocale();

  return (
    <section id="pricing" className="flex flex-col gap-12 scroll-mt-20">
      <div className="text-center flex flex-col gap-3">
        <h2 className="text-3xl sm:text-4xl font-bold">{t('landing.pricingTitle')}</h2>
        <p className="text-slate-400 max-w-xl mx-auto">
          اختر الباقة المناسبة لاحتياجاتك وابدأ في رفع مستوى دراستك اليوم.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto w-full">
        {/* Free Plan */}
        <Card className="flex flex-col justify-between border-slate-800 bg-slate-900/10 p-6 transition-all duration-300 hover:scale-[1.01] hover:border-slate-700/60 hover:shadow-lg hover:shadow-slate-500/5">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-slate-400 text-sm font-semibold">{t('landing.freePlan')}</span>
              <span className="text-3xl font-extrabold text-white">{t('landing.priceFree')}</span>
            </div>
            <ul className="flex flex-col gap-3.5 text-sm text-slate-300">
              <li className="flex items-center gap-2.5">
                <Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                <span>{t('landing.pricingFeature1')}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                <span>مراجعة بطاقات فلاش محدودة</span>
              </li>
            </ul>
          </div>
          <Button href="/register" variant="secondary" className="w-full mt-8">
            {t('landing.startFree')}
          </Button>
        </Card>

        {/* Pro Plan */}
        <Card className="flex flex-col justify-between border-indigo-500/60 bg-slate-900/50 p-6 relative shadow-xl shadow-indigo-500/5 transition-all duration-300 hover:scale-[1.02] hover:border-indigo-500 hover:shadow-indigo-500/10">
          <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2">
            <Badge variant="primary" className="px-3 py-1 font-bold">
              {t('landing.mostPopular')}
            </Badge>
          </div>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-indigo-400 text-sm font-semibold">{t('landing.proPlan')}</span>
              <span className="text-3xl font-extrabold text-white">{t('landing.pricePro')}</span>
            </div>
            <ul className="flex flex-col gap-3.5 text-sm text-slate-200">
              <li className="flex items-center gap-2.5">
                <Check className="w-4.5 h-4.5 text-indigo-400 shrink-0" />
                <span>{t('landing.pricingFeature2')}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4.5 h-4.5 text-indigo-400 shrink-0" />
                <span>{t('landing.pricingFeature4')}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4.5 h-4.5 text-indigo-400 shrink-0" />
                <span>توليد وتلخيص فوري بالذكاء الاصطناعي</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4.5 h-4.5 text-indigo-400 shrink-0" />
                <span>تعطيل إعلانات Google AdSense</span>
              </li>
            </ul>
          </div>
          <Button href="/register" className="w-full mt-8 font-bold">
            اشترك الآن
          </Button>
        </Card>

        {/* Institution Plan */}
        <Card className="flex flex-col justify-between border-slate-800 bg-slate-900/10 p-6 transition-all duration-300 hover:scale-[1.01] hover:border-slate-700/60 hover:shadow-lg hover:shadow-slate-500/5">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-slate-400 text-sm font-semibold">{t('landing.institutionPlan')}</span>
              <span className="text-3xl font-extrabold text-white">{t('landing.priceInst')}</span>
            </div>
            <ul className="flex flex-col gap-3.5 text-sm text-slate-300">
              <li className="flex items-center gap-2.5">
                <Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                <span>حسابات مخصصة للمدارس والجامعات</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                <span>{t('landing.pricingFeature3')}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                <span>مساحات عمل مشتركة للطلاب</span>
              </li>
            </ul>
          </div>
          <Button href="mailto:info@studyai.com" variant="secondary" className="w-full mt-8">
            تواصل معنا
          </Button>
        </Card>
      </div>
    </section>
  );
};

export const Pricing = memo(PricingComponent);
