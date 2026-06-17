'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useLocale } from '../../../hooks/use-locale';
import { api } from '../../../lib/api';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Spinner } from '../../../components/ui/spinner';
import {
  Crown,
  Zap,
  Building2,
  Check,
  X,
  CreditCard,
  FileText,
  MessageSquare,
  BarChart3,
  Headphones,
  Shield,
  Users,
  Code,
  ExternalLink,
  Receipt,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Ban,
  CalendarDays,
  Download,
  AlertCircle,
} from 'lucide-react';

/* ────────── Types ────────── */

interface Subscription {
  id?: string;
  userId?: string;
  plan: 'free' | 'pro' | 'institution';
  status: 'active' | 'canceled' | 'trial' | 'expired';
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  monthlyFileLimit: number;
  monthlyQuestionLimit: number;
  filesUsedThisMonth: number;
  questionsUsedThisMonth: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt?: string | null;
}

interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string;
  stripePaymentId: string;
  amount: string; // decimal string from DB
  currency: string;
  status: 'succeeded' | 'failed' | 'pending';
  invoiceUrl?: string | null;
  createdAt: string;
}

/* ────────── Helper Components ────────── */

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    canceled: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
    trial: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
    expired: { bg: 'bg-rose-500/10', text: 'text-rose-400', dot: 'bg-rose-400' },
  };
  const s = map[status] ?? map.expired;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
      {t(`subscription.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
    </span>
  );
}

function PaymentStatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const map: Record<string, { bg: string; text: string }> = {
    succeeded: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    failed: { bg: 'bg-rose-500/10', text: 'text-rose-400' },
    pending: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {t(`subscription.payment${status.charAt(0).toUpperCase() + status.slice(1)}`)}
    </span>
  );
}

function UsageBar({
  label,
  used,
  limit,
  icon: Icon,
}: {
  label: string;
  used: number;
  limit: number;
  icon: React.ElementType;
}) {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const danger = pct >= 90;
  const warn = pct >= 70 && pct < 90;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-slate-300">
          <Icon className="w-4 h-4 text-indigo-400" />
          {label}
        </span>
        <span className="font-mono text-slate-400">
          {used.toLocaleString()} / {isUnlimited ? '∞' : limit.toLocaleString()}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800/60 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            danger
              ? 'bg-gradient-to-r from-rose-500 to-red-500'
              : warn
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-gradient-to-r from-indigo-500 to-purple-500'
          }`}
          style={{ width: isUnlimited ? '0%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ────────── Plan Definitions ────────── */

function getPlanFeatures(t: (k: string) => string) {
  return {
    free: {
      name: t('subscription.planFree'),
      price: '$0',
      period: t('subscription.perMonth'),
      icon: Zap,
      gradient: false,
      features: [
        { text: t('subscription.freeFeature1'), included: true },
        { text: t('subscription.freeFeature2'), included: true },
        { text: t('subscription.freeFeature3'), included: true },
        { text: t('subscription.freeFeature4'), included: true },
        { text: t('subscription.freeFeature5'), included: false },
        { text: t('subscription.freeFeature6'), included: false },
      ],
    },
    pro: {
      name: t('subscription.planPro'),
      price: '$9.99',
      period: t('subscription.perMonth'),
      icon: Crown,
      gradient: true,
      features: [
        { text: t('subscription.proFeature1'), included: true },
        { text: t('subscription.proFeature2'), included: true },
        { text: t('subscription.proFeature3'), included: true },
        { text: t('subscription.proFeature4'), included: true },
        { text: t('subscription.proFeature5'), included: true },
        { text: t('subscription.proFeature6'), included: true },
      ],
    },
    institution: {
      name: t('subscription.planInstitution'),
      price: t('subscription.customPricing'),
      period: '',
      icon: Building2,
      gradient: false,
      features: [
        { text: t('subscription.instFeature1'), included: true },
        { text: t('subscription.instFeature2'), included: true },
        { text: t('subscription.instFeature3'), included: true },
        { text: t('subscription.instFeature4'), included: true },
        { text: t('subscription.instFeature5'), included: true },
        { text: t('subscription.instFeature6'), included: true },
      ],
    },
  };
}

/* ────────── Main Page ────────── */

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { t, dir } = useLocale();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [sub, pay] = await Promise.all([
        api.get<Subscription>('/subscriptions/current'),
        api.get<Payment[]>('/payments/history'),
      ]);
      setSubscription(sub);
      setPayments(pay);
    } catch (err: any) {
      setError(err.message || t('subscription.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Actions ── */

  const handleCheckout = async (plan: 'pro' | 'institution') => {
    try {
      setActionLoading(`checkout-${plan}`);
      const data = await api.post<{ checkoutUrl: string }>('/subscriptions/checkout', { plan });
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setError(err.message || t('subscription.errorCheckout'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    try {
      setActionLoading('cancel');
      const updated = await api.post<Subscription>('/subscriptions/cancel');
      setSubscription(updated);
    } catch (err: any) {
      setError(err.message || t('subscription.errorCancel'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading('resume');
      const updated = await api.post<Subscription>('/subscriptions/resume');
      setSubscription(updated);
    } catch (err: any) {
      setError(err.message || t('subscription.errorResume'));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePortal = async () => {
    try {
      setActionLoading('portal');
      const data = await api.post<{ portalUrl: string }>('/subscriptions/portal');
      window.location.href = data.portalUrl;
    } catch (err: any) {
      setError(err.message || t('subscription.errorPortal'));
    } finally {
      setActionLoading(null);
    }
  };

  /* ── Plan data ── */

  const plans = getPlanFeatures(t);
  const planKeys: Array<'free' | 'pro' | 'institution'> = ['free', 'pro', 'institution'];
  const currentPlan = subscription?.plan ?? 'free';

  /* ── Loading State ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="w-10 h-10 border-4" />
          <p className="text-slate-400 text-sm">{t('subscription.loading')}</p>
        </div>
      </div>
    );
  }

  /* ── Render ── */

  return (
    <div className="space-y-8 pb-12" dir={dir}>
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold gradient-text">{t('subscription.title')}</h1>
        <p className="text-slate-400 mt-1">{t('subscription.subtitle')}</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ms-auto text-rose-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ═══════ Current Plan Card ═══════ */}
      {subscription && (
        <Card glass hoverable={false} className="relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                {/* Plan Icon with glow */}
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                    currentPlan === 'pro'
                      ? 'gradient-primary shadow-indigo-500/25'
                      : currentPlan === 'institution'
                        ? 'bg-emerald-500/20 border border-emerald-500/30 shadow-emerald-500/15'
                        : 'bg-slate-800/60 border border-slate-700/40'
                  }`}
                >
                  {currentPlan === 'pro' ? (
                    <Crown className="w-7 h-7 text-white" />
                  ) : currentPlan === 'institution' ? (
                    <Building2 className="w-7 h-7 text-emerald-400" />
                  ) : (
                    <Zap className="w-7 h-7 text-slate-300" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-white">
                      {plans[currentPlan].name}
                    </h2>
                    <StatusBadge status={subscription.status} t={t} />
                  </div>
                  <p className="text-slate-400 text-sm mt-0.5">
                    {subscription.status !== 'expired' && subscription.currentPeriodStart && subscription.currentPeriodEnd && (
                      <>
                        <CalendarDays className="w-3.5 h-3.5 inline-block me-1 -mt-0.5" />
                        {t('subscription.periodLabel')}{' '}
                        {new Date(subscription.currentPeriodStart).toLocaleDateString()} –{' '}
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                {currentPlan !== 'free' && subscription.status === 'active' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={actionLoading === 'portal'}
                      onClick={handlePortal}
                    >
                      <CreditCard className="w-4 h-4 me-1.5" />
                      {t('subscription.manageBilling')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={actionLoading === 'cancel'}
                      onClick={handleCancel}
                    >
                      <Ban className="w-4 h-4 me-1.5" />
                      {t('subscription.cancelPlan')}
                    </Button>
                  </>
                )}
                {subscription.status === 'canceled' && (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={actionLoading === 'resume'}
                    onClick={handleResume}
                  >
                    <RefreshCw className="w-4 h-4 me-1.5" />
                    {t('subscription.resumePlan')}
                  </Button>
                )}
              </div>
            </div>

            {/* Usage Meters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              <UsageBar
                label={t('subscription.filesUsed')}
                used={subscription.filesUsedThisMonth}
                limit={subscription.monthlyFileLimit}
                icon={FileText}
              />
              <UsageBar
                label={t('subscription.questionsUsed')}
                used={subscription.questionsUsedThisMonth}
                limit={subscription.monthlyQuestionLimit}
                icon={MessageSquare}
              />
            </div>

            {/* Upgrade CTA for free plan */}
            {currentPlan === 'free' && (
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 border border-indigo-500/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <div>
                      <p className="text-sm font-semibold text-white">{t('subscription.upgradeCta')}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{t('subscription.upgradeCtaDesc')}</p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={actionLoading === 'checkout-pro'}
                    onClick={() => handleCheckout('pro')}
                  >
                    {t('subscription.upgradeNow')}
                    <ArrowRight className="w-4 h-4 ms-1.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ═══════ Plan Comparison ═══════ */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('subscription.comparePlans')}</h2>
        <p className="text-slate-400 text-sm mb-6">{t('subscription.comparePlansDesc')}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {planKeys.map((planKey) => {
            const plan = plans[planKey];
            const Icon = plan.icon;
            const isCurrent = currentPlan === planKey;
            const isPro = planKey === 'pro';
            const isInstitution = planKey === 'institution';

            return (
              <div
                key={planKey}
                className={`relative rounded-2xl transition-all duration-300 hover:-translate-y-1 ${
                  isPro ? 'p-[2px]' : ''
                }`}
                style={
                  isPro
                    ? {
                        background:
                          'linear-gradient(135deg, #6366f1, #a855f7, #3b82f6, #6366f1)',
                        backgroundSize: '300% 300%',
                        animation: 'gradientShift 4s ease infinite',
                      }
                    : undefined
                }
              >
                {/* "Most Popular" badge for Pro */}
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                    <span className="gradient-primary text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg shadow-indigo-500/25">
                      {t('subscription.mostPopular')}
                    </span>
                  </div>
                )}

                <div
                  className={`rounded-2xl p-6 h-full flex flex-col ${
                    isPro
                      ? 'bg-[#0b0f19]'
                      : 'glass border border-slate-800/40'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isPro
                          ? 'gradient-primary shadow-md shadow-indigo-500/25'
                          : isInstitution
                            ? 'bg-emerald-500/15 border border-emerald-500/25'
                            : 'bg-slate-800/60 border border-slate-700/40'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${
                          isPro ? 'text-white' : isInstitution ? 'text-emerald-400' : 'text-slate-300'
                        }`}
                      />
                    </div>
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <span
                      className={`text-4xl font-extrabold ${
                        isPro ? 'gradient-text' : 'text-white'
                      }`}
                    >
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-slate-400 text-sm ms-1">
                        {plan.period}
                      </span>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-grow">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        {feat.included ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-emerald-400" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-800/60 flex items-center justify-center shrink-0 mt-0.5">
                            <X className="w-3 h-3 text-slate-500" />
                          </div>
                        )}
                        <span className={feat.included ? 'text-slate-200' : 'text-slate-500'}>
                          {feat.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <div className="mt-auto">
                    {isCurrent ? (
                      <Button variant="secondary" className="w-full" disabled>
                        <Check className="w-4 h-4 me-1.5" />
                        {t('subscription.currentPlan')}
                      </Button>
                    ) : isInstitution ? (
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => {
                          window.location.href = 'mailto:sales@studyai.com';
                        }}
                      >
                        <Headphones className="w-4 h-4 me-1.5" />
                        {t('subscription.contactSales')}
                      </Button>
                    ) : planKey === 'pro' ? (
                      <Button
                        variant="primary"
                        className="w-full"
                        loading={actionLoading === 'checkout-pro'}
                        onClick={() => handleCheckout('pro')}
                      >
                        <Sparkles className="w-4 h-4 me-1.5" />
                        {t('subscription.upgradeNow')}
                      </Button>
                    ) : (
                      /* Free plan - currently on a paid plan */
                      <Button variant="ghost" className="w-full" disabled>
                        {t('subscription.freePlanLabel')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════ Payment History ═══════ */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('subscription.paymentHistory')}</h2>
        <p className="text-slate-400 text-sm mb-6">{t('subscription.paymentHistoryDesc')}</p>

        <Card glass hoverable={false}>
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/30 flex items-center justify-center mb-4">
                <Receipt className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm">{t('subscription.noPayments')}</p>
              <p className="text-slate-500 text-xs mt-1">{t('subscription.noPaymentsDesc')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800/50">
                    <th className="text-start text-slate-400 font-medium pb-3 pe-4">
                      {t('subscription.paymentDate')}
                    </th>
                    <th className="text-start text-slate-400 font-medium pb-3 pe-4">
                      {t('subscription.paymentAmount')}
                    </th>
                    <th className="text-start text-slate-400 font-medium pb-3 pe-4">
                      {t('subscription.paymentStatus')}
                    </th>
                    <th className="text-end text-slate-400 font-medium pb-3">
                      {t('subscription.paymentInvoice')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-slate-800/20 last:border-0 hover:bg-slate-800/20 transition-colors"
                    >
                      <td className="py-3.5 pe-4 text-slate-200">
                        {new Date(payment.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 pe-4 font-mono font-semibold text-white">
                        ${parseFloat(payment.amount).toFixed(2)}{' '}
                        <span className="text-slate-500 font-normal uppercase text-xs">
                          {payment.currency}
                        </span>
                      </td>
                      <td className="py-3.5 pe-4">
                        <PaymentStatusBadge status={payment.status} t={t} />
                      </td>
                      <td className="py-3.5 text-end">
                        {payment.invoiceUrl ? (
                          <a
                            href={payment.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors text-xs font-medium"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {t('subscription.downloadInvoice')}
                          </a>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Gradient animation keyframes injected via style tag */}
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
