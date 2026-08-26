'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../../../../lib/api-client';
import { useLocale } from '../../../../hooks/use-locale';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Spinner } from '../../../../components/ui/spinner';
import { Button } from '../../../../components/ui/button';
import {
  TrendingUp,
  Coins,
  Cpu,
  Users,
  BarChart3,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  DollarSign,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminAnalyticsDashboardPage() {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);

  // States for stats
  const [billingStats, setBillingStats] = useState<any | null>(null);
  const [aiStats, setAiStats] = useState<any | null>(null);
  const [retentionStats, setRetentionStats] = useState<any[]>([]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [billing, ai, retention] = await Promise.all([
        api.get<any>('/admin/billing/stats'),
        api.get<any>('/admin/ai/stats'),
        api.get<any[]>('/admin/retention'),
      ]);
      setBillingStats(billing);
      setAiStats(ai);
      setRetentionStats(retention || []);
    } catch (e) {
      console.error('Failed to load admin stats', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  // Calculate some aggregate values for safety fallbacks
  const mrr = billingStats?.mrr || 0;
  const arr = billingStats?.arr || 0;
  const netProfit = billingStats?.netProfit || 0;
  const totalRevenue = billingStats?.totalRevenue || 0;
  const totalAiCost = billingStats?.totalAiCost || 0;

  // Helper to color code retention percentage cells (Heatmap style)
  const getRetentionCellClass = (percent: number) => {
    if (percent === 100) return 'bg-indigo-500/30 text-indigo-300 font-bold border border-indigo-500/20';
    if (percent >= 75) return 'bg-indigo-600/20 text-indigo-300 border border-indigo-600/10';
    if (percent >= 50) return 'bg-indigo-700/15 text-indigo-400 border border-indigo-700/5';
    if (percent >= 25) return 'bg-indigo-950/20 text-slate-400';
    if (percent > 0) return 'bg-slate-950/10 text-slate-500';
    return 'bg-slate-950/5 text-slate-600 border border-transparent';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/40 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            <span>{locale === 'ar' ? 'تحليلات النظام وإدارة SaaS' : 'SaaS System Analytics'}</span>
          </h2>
          <p className="text-xs text-slate-400">
            {locale === 'ar'
              ? 'مراقبة الإيرادات المتكررة، تكاليف الـ AI، ومعدل الاحتفاظ بالمستخدمين.'
              : 'Monitor recurring MRR/ARR, aggregate token spend, and user cohort retention rates.'}
          </p>
        </div>

        <Button
          nativeButton={false}
          render={<Link href="/admin" />}
          variant="secondary"
          className="border-slate-800 text-slate-400 hover:text-white cursor-pointer font-semibold py-1.5 px-3.5 text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5 rtl:ml-1.5" />
          <span>{locale === 'ar' ? 'العودة للوحة الإدارة' : 'Back to Admin'}</span>
        </Button>
      </div>

      {/* 4 Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* MRR */}
        <Card className="p-5 bg-gradient-to-tr from-indigo-500/5 via-slate-900/30 to-slate-900/10 border-slate-800/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{locale === 'ar' ? 'الإيراد الشهري المتكرر' : 'MRR'}</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            <span className="text-2xl font-black text-white">${mrr.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500">{locale === 'ar' ? 'من الاشتراكات النشطة' : 'Based on active subscriptions'}</span>
          </div>
        </Card>

        {/* ARR */}
        <Card className="p-5 bg-slate-900/20 border-slate-800/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{locale === 'ar' ? 'الإيراد السنوي المتوقع' : 'ARR'}</span>
            <Coins className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            <span className="text-2xl font-black text-white">${arr.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500">{locale === 'ar' ? 'إجمالي ضرب الإيراد بـ 12' : 'Calculated as MRR x 12'}</span>
          </div>
        </Card>

        {/* Net Profit */}
        <Card className="p-5 bg-slate-900/20 border-slate-800/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{locale === 'ar' ? 'صافي الأرباح' : 'Net Profit'}</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            <span className="text-2xl font-black text-emerald-400">${netProfit.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500">{locale === 'ar' ? 'بعد خصم تكاليف الخادم والـ AI' : 'Revenues minus total AI spent'}</span>
          </div>
        </Card>

        {/* Total AI cost */}
        <Card className="p-5 bg-slate-900/20 border-slate-800/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{locale === 'ar' ? 'تكاليف الـ AI الإجمالية' : 'Total AI Cost'}</span>
            <Cpu className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            <span className="text-2xl font-black text-rose-400">${totalAiCost.toFixed(4)}</span>
            <span className="text-[10px] text-slate-500">{locale === 'ar' ? 'تكلفة تشغيل الـ LLM والنماذج' : 'Tokens billed on models'}</span>
          </div>
        </Card>
      </div>

      {/* Main Panels Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cohort Retention Tracker */}
        <Card className="lg:col-span-7 p-6 bg-slate-900/30 border-slate-800/40 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>{locale === 'ar' ? 'الاحتفاظ بالمستخدمين (حسب أفواج التسجيل)' : 'User Cohort Retention Rate Tracker'}</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {locale === 'ar'
                ? 'معدل عودة ونشاط المستخدمين في الأسابيع التالية لتسجيلهم.'
                : 'Percentage of users in weekly registration cohorts who returned to study in subsequent weeks.'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="text-slate-500 uppercase tracking-wider border-b border-slate-800/40 text-[10px]">
                  <th className="py-2.5 text-left rtl:text-right font-bold w-28">{locale === 'ar' ? 'أسبوع التسجيل' : 'Registration Cohort'}</th>
                  <th className="py-2.5 font-bold w-16">{locale === 'ar' ? 'الحجم' : 'Size'}</th>
                  <th className="py-2.5 font-bold">W0</th>
                  <th className="py-2.5 font-bold">W1</th>
                  <th className="py-2.5 font-bold">W2</th>
                  <th className="py-2.5 font-bold">W3</th>
                  <th className="py-2.5 font-bold">W4</th>
                </tr>
              </thead>
              <tbody>
                {retentionStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-slate-500 text-center">
                      {locale === 'ar' ? 'لا توجد بيانات كافية للاحتفاظ' : 'No cohort data calculated.'}
                    </td>
                  </tr>
                ) : (
                  retentionStats.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-850/30">
                      <td className="py-3 text-left rtl:text-right font-semibold text-slate-300">
                        {row.cohort}
                      </td>
                      <td className="py-3 text-slate-400 font-semibold">{row.size}</td>
                      {[0, 1, 2, 3, 4].map((week) => {
                        const val = row.retention[week] !== undefined ? row.retention[week] : 0;
                        return (
                          <td key={week} className="p-0.5">
                            <div className={`py-1.5 rounded text-[11px] font-bold ${getRetentionCellClass(val)}`}>
                              {val}%
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* AI Agent breakdown */}
        <Card className="lg:col-span-5 p-6 bg-slate-900/30 border-slate-800/40 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>{locale === 'ar' ? 'استهلاك وكلاء الذكاء الاصطناعي' : 'AI Agent Resource Breakdown'}</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {locale === 'ar'
                ? 'تفصيل عدد المكالمات والتكلفة لكل وكيل AI نشط.'
                : 'Billed operational request counts and cost breakdown by worker agent types.'}
            </p>
          </div>

          <div className="flex flex-col gap-3.5">
            {aiStats?.agentAggregates?.length === 0 ? (
              <div className="py-6 text-slate-500 text-center text-xs">
                {locale === 'ar' ? 'لا توجد سجلات استهلاك للـ AI' : 'No AI token usage logged yet.'}
              </div>
            ) : (
              aiStats?.agentAggregates?.map((agent: any, idx: number) => (
                <div key={idx} className="bg-slate-950/40 border border-slate-850/60 p-3.5 rounded-xl flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white capitalize">
                      {agent.agentType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] font-bold text-rose-400">
                      ${Number(agent.totalCostUSD).toFixed(5)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-semibold border-t border-slate-850/30 pt-2">
                    <div className="flex flex-col">
                      <span>{locale === 'ar' ? 'الطلبات:' : 'Requests:'}</span>
                      <span className="text-slate-350">{agent.requestCount}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span>{locale === 'ar' ? 'مجموع الرموز:' : 'Tokens Sum:'}</span>
                      <span className="text-slate-350">
                        {Number(agent.totalPromptTokens) + Number(agent.totalCompletionTokens)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Model-level aggregated pricing */}
      <Card className="p-6 bg-slate-900/30 border-slate-800/40 flex flex-col gap-4">
        <h3 className="text-base font-bold text-white flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-indigo-400" />
          <span>{locale === 'ar' ? 'مستويات استهلاك الموديلات' : 'Model Billed Costs Aggregations'}</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {aiStats?.modelAggregates?.map((model: any, idx: number) => (
            <div key={idx} className="bg-slate-950/20 border border-slate-850/30 p-4 rounded-xl flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white">{model.model}</span>
                <span className="text-[10px] text-slate-500">{locale === 'ar' ? `المكالمات: ${model.requestCount}` : `Calls: ${model.requestCount}`}</span>
              </div>
              <span className="text-xs font-bold text-rose-400">${Number(model.totalCostUSD).toFixed(4)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
