'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useLocale } from '../../../hooks/use-locale';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Spinner } from '../../../components/ui/spinner';
import { Button } from '../../../components/ui/button';
import {
  FileText,
  Clock,
  CheckSquare,
  Award,
  Upload,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { formatDate } from '../../../lib/utils';

export default function DashboardPage() {
  const { t, locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [filesCount, setFilesCount] = useState(0);
  const [recentFiles, setRecentFiles] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await api.get<any>('/files?limit=5');
        setFilesCount(response.pagination?.total || 0);
        setRecentFiles(response.data || []);
      } catch (e) {
        console.error('Failed to load dashboard files', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  const statCards = [
    { label: t('dashboard.uploadedFiles'), value: filesCount, icon: FileText, color: 'text-indigo-400 bg-indigo-500/10' },
    { label: t('dashboard.completedExams'), value: '0', icon: CheckSquare, color: 'text-emerald-400 bg-emerald-500/10' },
    { label: t('dashboard.studyHours'), value: '0', icon: Clock, color: 'text-amber-400 bg-amber-500/10' },
    { label: t('dashboard.completionRate'), value: '0%', icon: Award, color: 'text-rose-400 bg-rose-500/10' },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="flex items-center gap-4 bg-slate-900/40 border-slate-800/45 p-6 hover:-translate-y-0.5">
              <div className={`p-3 rounded-lg shrink-0 ${stat.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-sm text-slate-400 truncate">{stat.label}</span>
                <span className="text-2xl font-bold text-white truncate">{stat.value}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Quick Action + Recent Files */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Files Table/List */}
        <Card className="lg:col-span-2 flex flex-col gap-4 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-white">{t('dashboard.recentFiles')}</h4>
            <Link href="/files" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-1.5 transition-colors">
              <span>عرض الكل</span>
              <ArrowRight className="w-4 h-4 rtl-flip" />
            </Link>
          </div>

          {recentFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 border border-dashed border-slate-800 rounded-lg bg-slate-950/20">
              <BookOpen className="w-10 h-10 text-slate-600" />
              <p className="text-sm text-slate-500">لا توجد ملفات مرفوعة حالياً</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recentFiles.map((file) => (
                <Link
                  key={file.id}
                  href={`/files/${file.id}`}
                  className="flex items-center justify-between p-3.5 bg-slate-900/20 border border-slate-800/40 rounded-lg hover:border-indigo-500/20 hover:bg-slate-900/60 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-semibold text-slate-200 truncate group-hover:text-white">
                        {file.originalName}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDate(file.createdAt, locale)}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={
                      file.processingStatus === 'completed'
                        ? 'success'
                        : file.processingStatus === 'failed'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {file.processingStatus === 'completed'
                      ? t('files.statusCompleted')
                      : file.processingStatus === 'failed'
                      ? t('files.statusFailed')
                      : t('files.statusProcessing')}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions Panel */}
        <Card className="flex flex-col gap-5 bg-slate-900/40 p-6">
          <h4 className="text-lg font-bold text-white">{t('dashboard.quickActions')}</h4>
          <div className="flex flex-col gap-3">
            <Link href="/files" className="w-full">
              <Button className="w-full gap-2 font-bold py-3.5">
                <Upload className="w-4.5 h-4.5" />
                <span>{t('dashboard.uploadNewFile')}</span>
              </Button>
            </Link>

            <Button variant="secondary" disabled className="w-full gap-2 py-3.5 opacity-50 cursor-not-allowed">
              <span>{t('dashboard.startQuiz')}</span>
            </Button>

            <Button variant="secondary" disabled className="w-full gap-2 py-3.5 opacity-50 cursor-not-allowed">
              <span>{t('dashboard.reviewCards')}</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
