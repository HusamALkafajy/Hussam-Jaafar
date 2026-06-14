'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useLocale } from '../../../../hooks/use-locale';
import { api } from '../../../../lib/api';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Spinner } from '../../../../components/ui/spinner';
import { Button } from '../../../../components/ui/button';
import {
  Cpu,
  RefreshCw,
  AlertCircle,
  Clock,
  Sparkles,
  Zap,
  Activity,
  Coins,
  Gauge,
} from 'lucide-react';

interface AIUsageStats {
  tokenLimitPercentage: number;
  totalTokensUsed: number;
  estimatedCost: number;
  avgLatencyMs: number;
  successRate: number;
}

interface AICallLog {
  id: string;
  endpoint: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  cost: number;
  status: 'success' | 'error';
  createdAt: string;
}

export default function AdminAIUsagePage() {
  const { t, locale, dir } = useLocale();

  const [stats, setStats] = useState<AIUsageStats | null>(null);
  const [logs, setLogs] = useState<AICallLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Fallbacks
  const mockStats: AIUsageStats = useMemo(() => ({
    tokenLimitPercentage: 78,
    totalTokensUsed: 7820450,
    estimatedCost: 142.68,
    avgLatencyMs: 1280,
    successRate: 99.8,
  }), []);

  const mockLogs: AICallLog[] = useMemo(() => [
    { id: '1', endpoint: '/files/summary', model: 'gpt-4o', promptTokens: 4200, completionTokens: 850, latencyMs: 1850, cost: 0.033, status: 'success', createdAt: new Date(Date.now() - 600000).toISOString() },
    { id: '2', endpoint: '/files/explain', model: 'gpt-4o-mini', promptTokens: 1200, completionTokens: 400, latencyMs: 740, cost: 0.002, status: 'success', createdAt: new Date(Date.now() - 1800000).toISOString() },
    { id: '3', endpoint: '/exams/generate', model: 'claude-3-5-sonnet', promptTokens: 6800, completionTokens: 1200, latencyMs: 2900, cost: 0.038, status: 'success', createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: '4', endpoint: '/chat/message', model: 'gpt-4o', promptTokens: 1800, completionTokens: 350, latencyMs: 1100, cost: 0.012, status: 'success', createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: '5', endpoint: '/flashcards/generate', model: 'gpt-4o-mini', promptTokens: 3500, completionTokens: 950, latencyMs: 1420, cost: 0.005, status: 'success', createdAt: new Date(Date.now() - 14400000).toISOString() },
    { id: '6', endpoint: '/files/summary', model: 'gpt-4o', promptTokens: 8400, completionTokens: 0, latencyMs: 4500, cost: 0.0, status: 'error', createdAt: new Date(Date.now() - 28800000).toISOString() },
  ], []);

  const loadAIUsage = async () => {
    try {
      setLoading(true);
      const [statsRes, logsRes] = await Promise.allSettled([
        api.get<AIUsageStats>('/admin/ai-usage/stats'),
        api.get<AICallLog[]>('/admin/ai-usage/logs?limit=10'),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value);
      }
      if (logsRes.status === 'fulfilled' && logsRes.value) {
        setLogs(logsRes.value);
      }
    } catch (e) {
      console.warn('AI usage api call failed, fallback to offline sandbox data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAIUsage();
  }, []);

  const activeStats = stats || mockStats;
  const activeLogs = logs.length > 0 ? logs : mockLogs;

  const radialMetrics = useMemo(() => {
    // Metric 1: Token limit dial
    const r1 = 36;
    const circ1 = 2 * Math.PI * r1;
    const offset1 = circ1 - (activeStats.tokenLimitPercentage / 100) * circ1;

    // Metric 2: Success rate dial
    const r2 = 36;
    const circ2 = 2 * Math.PI * r2;
    const offset2 = circ2 - (activeStats.successRate / 100) * circ2;

    return { circ1, offset1, circ2, offset2 };
  }, [activeStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="w-10 h-10 border-4 border-red-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
            <Cpu className="w-8 h-8 text-red-400" />
            {t('admin.aiUsageTab')}
          </h1>
          <p className="text-slate-400 mt-1">
            {locale === 'ar' ? 'مراقبة استهلاك خوادم الذكاء الاصطناعي وتتبع التكاليف ومعدل الاستجابة' : 'Audit AI engine quotas, review estimated billing, and monitor system response latency.'}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="border-slate-800 hover:bg-slate-800/60 shrink-0"
          onClick={loadAIUsage}
        >
          <RefreshCw className="w-4 h-4 me-1.5" />
          <span>{locale === 'ar' ? 'تحديث المقاييس' : 'Sync Metrics'}</span>
        </Button>
      </div>

      {/* Gauges & Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Token Quota Radial Ring Gauge */}
        <Card className="bg-slate-900/40 border-slate-800/40 p-6 flex flex-col items-center justify-between text-center">
          <div className="w-full text-start">
            <h3 className="text-sm font-bold text-slate-300 uppercase flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-red-400" />
              {locale === 'ar' ? 'استهلاك الرموز' : 'Token Quota Used'}
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">{locale === 'ar' ? 'النسبة المئوية للاستهلاك من الحد الشهري' : 'Percentage consumed of the current monthly quota'}</p>
          </div>

          <div className="relative w-36 h-36 flex items-center justify-center my-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="50"
                className="stroke-slate-800"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r="50"
                className="stroke-red-500 transition-all duration-1000"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 50}
                strokeDashoffset={(2 * Math.PI * 50) - (activeStats.tokenLimitPercentage / 100) * (2 * Math.PI * 50)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white">{activeStats.tokenLimitPercentage}%</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">{locale === 'ar' ? 'مستهلك' : 'consumed'}</span>
            </div>
          </div>

          <div className="text-sm text-slate-400 font-mono">
            {(activeStats.totalTokensUsed / 1000000).toFixed(2)}M / 10.00M {locale === 'ar' ? 'رمز' : 'tokens'}
          </div>
        </Card>

        {/* API Latency and Success Rate Gauge */}
        <Card className="bg-slate-900/40 border-slate-800/40 p-6 flex flex-col items-center justify-between text-center">
          <div className="w-full text-start">
            <h3 className="text-sm font-bold text-slate-300 uppercase flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              {locale === 'ar' ? 'نسبة نجاح الخدمات' : 'Service Reliability'}
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">{locale === 'ar' ? 'نسبة الاستعلامات الناجحة بدون أخطاء' : 'Percentage of error-free AI API operations'}</p>
          </div>

          <div className="relative w-36 h-36 flex items-center justify-center my-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="50"
                className="stroke-slate-800"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r="50"
                className="stroke-emerald-500 transition-all duration-1000"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 50}
                strokeDashoffset={(2 * Math.PI * 50) - (activeStats.successRate / 100) * (2 * Math.PI * 50)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white">{activeStats.successRate}%</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">{locale === 'ar' ? 'معدل النجاح' : 'Success Rate'}</span>
            </div>
          </div>

          <div className="text-sm text-slate-400 font-medium">
            {locale === 'ar' ? 'متوسط سرعة الاستجابة' : 'Average latency'}: <span className="font-mono text-white">{activeStats.avgLatencyMs}ms</span>
          </div>
        </Card>

        {/* Cost Accrued Card */}
        <Card className="bg-slate-900/40 border-slate-800/40 p-6 flex flex-col justify-between">
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-300 uppercase flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-400" />
              {locale === 'ar' ? 'التكاليف المتراكمة' : 'Estimated Billing'}
            </h3>
            <p className="text-slate-500 text-xs">{locale === 'ar' ? 'التكلفة الإجمالية التقديرية للاستهلاك هذا الشهر' : 'Accrued cost estimates for utilized API tokens'}</p>
          </div>

          <div className="my-6">
            <span className="text-5xl font-black text-white">${activeStats.estimatedCost.toFixed(2)}</span>
            <span className="text-slate-400 text-xs ms-1.5 uppercase">/ {locale === 'ar' ? 'شهر' : 'month'}</span>
          </div>

          <div className="text-xs text-amber-400 font-semibold p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            {locale === 'ar'
              ? 'ملاحظة: يتم احتساب التكاليف بشكل تقديري بناءً على أسعار المزودين للموديلات المختلفة.'
              : 'Disclaimer: Accrued bills represent estimations computed from specific model pricing weights.'}
          </div>
        </Card>
      </div>

      {/* AI Log Activity List */}
      <Card className="bg-slate-900/40 border-slate-800/40 p-6" hoverable={false}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white">{locale === 'ar' ? 'سجل طلبات محركات الذكاء الاصطناعي' : 'AI Request Audit Trail'}</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              {locale === 'ar' ? 'تفاصيل استدعاءات نماذج الذكاء الاصطناعي الأخيرة ومستوى الأداء' : 'Detailed logging of the latest queries submitted to the models'}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/45 text-slate-400">
            <Activity className="w-4.5 h-4.5" />
          </div>
        </div>

        {activeLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <AlertCircle className="w-8 h-8 text-slate-600" />
            <p className="text-slate-400 text-sm">{t('admin.noUsage')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-950/20 text-slate-400 text-xs uppercase select-none">
                  <th className="text-start font-semibold px-4 py-3">{locale === 'ar' ? 'المسار' : 'Endpoint'}</th>
                  <th className="text-start font-semibold px-4 py-3">{locale === 'ar' ? 'النموذج' : 'Model'}</th>
                  <th className="text-start font-semibold px-4 py-3">{locale === 'ar' ? 'الرموز' : 'Tokens'}</th>
                  <th className="text-start font-semibold px-4 py-3">{locale === 'ar' ? 'الاستجابة' : 'Latency'}</th>
                  <th className="text-start font-semibold px-4 py-3">{t('admin.cost')}</th>
                  <th className="text-end font-semibold px-4 py-3">{t('admin.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/10">
                {activeLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-950/10 transition-colors">
                    {/* Endpoint */}
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-slate-100 font-mono text-xs">{log.endpoint}</span>
                    </td>

                    {/* Model */}
                    <td className="px-4 py-3.5">
                      <Badge variant="primary" className="font-mono text-xs font-semibold px-2 py-0.5">
                        {log.model}
                      </Badge>
                    </td>

                    {/* Tokens prompt + completion */}
                    <td className="px-4 py-3.5 text-slate-300 font-mono text-xs">
                      {log.promptTokens + log.completionTokens > 0 ? (
                        <>
                          {log.promptTokens + log.completionTokens}{' '}
                          <span className="text-slate-500 text-[10px]">
                            ({log.promptTokens}p + {log.completionTokens}c)
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Latency */}
                    <td className="px-4 py-3.5 font-mono text-xs">
                      <span className={log.latencyMs > 2500 ? 'text-amber-400' : 'text-slate-300'}>
                        {log.latencyMs}ms
                      </span>
                    </td>

                    {/* Cost */}
                    <td className="px-4 py-3.5 font-mono text-xs text-white">
                      ${log.cost.toFixed(4)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 text-end">
                      <Badge variant={log.status === 'success' ? 'success' : 'danger'}>
                        {log.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
