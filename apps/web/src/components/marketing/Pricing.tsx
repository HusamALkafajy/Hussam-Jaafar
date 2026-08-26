'use client';

import React, { memo, useState } from 'react';
import { useLocale } from '../../hooks/use-locale';
import { useAuth } from '../../hooks/use-auth';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api-client';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';

const PricingComponent: React.FC = () => {
  const { t } = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  /**
   * Handle Pro plan click:
   * - If the user is authenticated → call checkout API directly.
   * - If not → redirect to /register?plan=pro so the auth flow auto-triggers checkout after registration.
   */
  const handleProCheckout = async () => {
    setCheckoutError(null);

    if (!user) {
      // Unauthenticated: redirect to register with plan param so post-auth redirect auto-triggers
      router.push('/register?plan=pro');
      return;
    }

    // Authenticated: call checkout API directly
    setCheckoutLoading(true);
    try {
      const data = await api.post<{ checkoutUrl: string }>('/subscriptions/checkout', { plan: 'pro' });
      window.location.href = data.checkoutUrl;
    } catch {
      setCheckoutError(t('landing.checkoutFailure'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <section id="pricing" className="flex flex-col gap-12 scroll-mt-20">
      <div className="text-center flex flex-col gap-3">
        <h2 className="text-3xl sm:text-4xl font-bold">{t('landing.pricingTitle')}</h2>
        <p className="text-slate-400 max-w-xl mx-auto">
          {t('landing.pricingSubtitle')}
        </p>
      </div>

      {checkoutError && (
        <div className="max-w-md mx-auto w-full p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm text-center">
          {checkoutError}
        </div>
      )}

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
                <span>{t('landing.freeFlashcards')}</span>
              </li>
            </ul>
          </div>
          <Button nativeButton={false} render={<Link href="/register" />} variant="secondary" className="w-full mt-8">
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
                <span>{t('landing.proInstantAi')}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4.5 h-4.5 text-indigo-400 shrink-0" />
                <span>{t('landing.adFree')}</span>
              </li>
            </ul>
          </div>
          <Button
            onClick={handleProCheckout}
            disabled={checkoutLoading}
            className="w-full mt-8 font-bold"
          >
            {checkoutLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('landing.checkoutLoading')}</span>
              </span>
            ) : (
              t('landing.subscribeNow')
            )}
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
                <span>{t('landing.institutionAccounts')}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                <span>{t('landing.pricingFeature3')}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                <span>{t('landing.sharedWorkspaces')}</span>
              </li>
            </ul>
          </div>
          <Button nativeButton={false} render={<a href="mailto:info@studyai.com" />} variant="secondary" className="w-full mt-8">
            {t('landing.contactUs')}
          </Button>
        </Card>
      </div>
    </section>
  );
};

export const Pricing = memo(PricingComponent);
