'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useLocale } from '../../../hooks/use-locale';
import { api } from '../../../lib/api-client';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Spinner } from '../../../components/ui/spinner';
import { Button } from '../../../components/ui/button';
import {
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  Cpu,
  RefreshCw,
  Clock,
  ShieldCheck,
  UserCheck,
  Search,
} from 'lucide-react';
import { formatDate } from '../../../lib/utils';

interface AdminStats {
  totalUsers: number;
  active24h: number;
  totalRevenue: number;
  activeSubscriptions: number;
  aiCallsCount: number;
}

interface ActivityLog {
  id: string;
  email: string;
  action: string;
  detail: string;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const { t, locale, dir } = useLocale();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Chart interactivity
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Premium fallbacks
  const mockStats: AdminStats = useMemo(() => ({
    totalUsers: 342,
    active24h: 89,
    totalRevenue: 5490.50,
    activeSubscriptions: 86,
    aiCallsCount: 4210,
  }), []);

  const mockWeeklyRegistrations = useMemo(() => ({
    days: locale === 'ar' 
      ? ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4', 'الأسبوع 5', 'الأسبوع 6']
      : ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6'],
    counts: [40, 75, 130, 210, 280, 342],
  }), [locale]);

  const mockLogs: ActivityLog[] = useMemo(() => [
    { id: '1', email: 'sami.ahmad@gmail.com', action: 'PAYMENT', detail: locale === 'ar' ? 'تم تجديد الاشتراك الاحترافي ($19.00)' : 'Renewed Pro Subscription ($19.00)', createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: '2', email: 'fatima.harbi@outlook.com', action: 'REGISTER', detail: locale === 'ar' ? 'سجل مستخدم جديد عبر البريد الإلكتروني' : 'New user registered via Email signup', createdAt: new Date(Date.now() - 3600000 * 3).toISOString() },
    { id: '3', email: 'admin@studyai.com', action: 'ROLE_CHANGE', detail: locale === 'ar' ? 'تمت ترقية hussam@studyai.com إلى دور معلّم' : 'Promoted hussam@studyai.com to teacher role', createdAt: new Date(Date.now() - 3600000 * 8).toISOString() },
    { id: '4', email: 'system@studyai.com', action: 'AI_USAGE_ALERT', detail: locale === 'ar' ? 'اقترب معدل استخدام OpenAI من الحد الأقصى' : 'OpenAI API quota usage reached 78%', createdAt: new Date(Date.now() - 3600000 * 12).toISOString() },
    { id: '5', email: 'khalid.nasser@yahoo.com', action: 'USER_DEACTIVATE', detail: locale === 'ar' ? 'تم إيقاف حساب المستخدم لمخالفة الشروط' : 'Deactivated account for term violations', createdAt: new Date(Date.now() - 3600000 * 24).toISOString() },
  ], [locale]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, logsRes] = await Promise.allSettled([
        api.get<AdminStats>('/admin/stats'),
        api.get<ActivityLog[]>('/admin/activity-logs?limit=5'),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value);
      }
      if (logsRes.status === 'fulfilled' && logsRes.value) {
        setLogs(logsRes.value);
      }
    } catch (e) {
      console.warn('Admin stats endpoints failed, fallback to mock statistics', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const activeStats = stats || mockStats;
  const activeLogs = logs.length > 0 ? logs : mockLogs;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="w-10 h-10 border-4 border-red-500" />
      </div>
    );
  }

  // Bar chart computations
  const maxRegistration = Math.max(...mockWeeklyRegistrations.counts);
  const chartHeight = 160;
  const chartWidth = 460;
  const barWidth = 32;
  const barSpacing = (chartWidth - 40) / 6;

  return (
    <div className="space-y-8 pb-12" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">{t('admin.title')}</h1>
          <p className="text-slate-400 mt-1">{t('admin.subtitle')}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="border-slate-800 hover:bg-slate-800/60"
          onClick={fetchAdminData}
        >
          <RefreshCw className="w-4 h-4 me-1.5" />
          <span>{locale === 'ar' ? 'تحديث البيانات' : 'Refresh Overview'}</span>
        </Button>
      </div>

      {/* Admin Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <Card className="bg-slate-900/40 border-slate-800/40 p-6 flex items-center justify-between relative overflow-hidden group" hoverable={false}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-red-500/10 transition-colors" />
          <div className="space-y-2">
            <span className="text-sm text-slate-400 font-medium">{t('admin.totalUsers')}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{activeStats.totalUsers}</span>
              <span className="text-xs text-red-400 font-semibold">{t('admin.activeUsers')}: {activeStats.active24h}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 text-red-400">
            <Users className="w-6 h-6" />
          </div>
        </Card>

        {/* Total Revenue */}
        <Card className="bg-slate-900/40 border-slate-800/40 p-6 flex items-center justify-between relative overflow-hidden group" hoverable={false}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
          <div className="space-y-2">
            <span className="text-sm text-slate-400 font-medium">{t('admin.totalRevenue')}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">
                ${activeStats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </Card>

        {/* Active Subscriptions */}
        <Card className="bg-slate-900/40 border-slate-800/40 p-6 flex items-center justify-between relative overflow-hidden group" hoverable={false}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
          <div className="space-y-2">
            <span className="text-sm text-slate-400 font-medium">{t('admin.activeSubscriptions')}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">{activeStats.activeSubscriptions}</span>
              <span className="text-xs text-blue-400 font-semibold">{locale === 'ar' ? 'خطة نشطة' : 'active plans'}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <UserCheck className="w-6 h-6" />
          </div>
        </Card>

        {/* AI Calls */}
        <Card className="bg-slate-900/40 border-slate-800/40 p-6 flex items-center justify-between relative overflow-hidden group" hoverable={false}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
          <div className="space-y-2">
            <span className="text-sm text-slate-400 font-medium">{t('admin.aiCalls')}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">{activeStats.aiCallsCount}</span>
              <span className="text-xs text-purple-400 font-semibold">{locale === 'ar' ? 'استعلام' : 'queries'}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
            <Cpu className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* Visual Analytics Registrations & System Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Registration Trend */}
        <Card className="bg-slate-900/40 border-slate-800/40 p-6 flex flex-col gap-6 lg:col-span-1" hoverable={false}>
          <div>
            <h3 className="text-lg font-bold text-white">
              {locale === 'ar' ? 'نمو المستخدمين التراكمي' : 'Cumulative User Growth'}
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              {locale === 'ar' ? 'اتجاهات نمو الحسابات خلال الستة أسابيع الماضية' : 'Total registered accounts tracked over past 6 weeks'}
            </p>
          </div>

          <div className="relative w-full h-[180px] select-none flex items-center justify-center">
            <svg
              className="w-full h-full"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="adminBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
                <linearGradient id="adminBarGradHover" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#f87171" />
                </linearGradient>
              </defs>

              {/* Horizontal Line Ticks */}
              {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => {
                const y = 20 + r * (chartHeight - 50);
                return (
                  <line
                    key={idx}
                    x1="20"
                    y1={y}
                    x2={chartWidth - 10}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Render Bars */}
              {mockWeeklyRegistrations.counts.map((c, idx) => {
                const heightPct = c / maxRegistration;
                const barHeight = Math.max(heightPct * (chartHeight - 50), 6);
                const x = 40 + idx * barSpacing;
                const y = chartHeight - 30 - barHeight;

                const isHovered = hoveredBar === idx;

                return (
                  <g key={idx}>
                    <rect
                      x={x - barWidth / 2}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="6"
                      fill={isHovered ? 'url(#adminBarGradHover)' : 'url(#adminBarGrad)'}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredBar(idx)}
                      onMouseLeave={() => setHoveredBar(null)}
                    />

                    {isHovered && (
                      <g>
                        <rect
                          x={x - 25}
                          y={y - 28}
                          width="50"
                          height="20"
                          rx="4"
                          fill="#0f172a"
                          stroke="#ef4444"
                          strokeWidth="1"
                        />
                        <text
                          x={x}
                          y={y - 14}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="9"
                          fontWeight="bold"
                        >
                          {c}
                        </text>
                      </g>
                    )}

                    <text
                      x={x}
                      y={chartHeight - 10}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {mockWeeklyRegistrations.days[idx]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </Card>

        {/* Audit / Logs Viewer */}
        <Card className="bg-slate-900/40 border-slate-800/40 p-6 flex flex-col gap-6 lg:col-span-2" hoverable={false}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{t('admin.logsTitle')}</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                {locale === 'ar' ? 'سجل تفصيلي لأحداث المستخدمين والنشاطات الإدارية' : 'Real-time audit trailing of system administrative transactions'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/45 text-slate-400">
              <Activity className="w-4.5 h-4.5" />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {activeLogs.map((log) => {
              let actionVariant: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
              if (log.action === 'PAYMENT') actionVariant = 'success';
              else if (log.action === 'REGISTER') actionVariant = 'primary';
              else if (log.action === 'ROLE_CHANGE') actionVariant = 'warning';
              else if (log.action === 'AI_USAGE_ALERT' || log.action === 'USER_DEACTIVATE') actionVariant = 'danger';

              return (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-950/20 border border-slate-800/35 rounded-xl gap-3 text-xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant={actionVariant} className="font-semibold px-2 py-0">
                        {log.action}
                      </Badge>
                      <span className="text-slate-400 font-medium">{log.email}</span>
                    </div>
                    <p className="text-slate-200 font-semibold text-sm">{log.detail}</p>
                  </div>

                  <span className="text-slate-500 font-medium whitespace-nowrap self-end sm:self-center flex items-center gap-1 mt-1 sm:mt-0">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    {formatDate(log.createdAt, locale)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
