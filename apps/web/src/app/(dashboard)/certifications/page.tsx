'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useLocale } from '../../../hooks/use-locale';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Spinner } from '../../../components/ui/spinner';
import { Award, Calendar, ExternalLink, Copy, Check, GraduationCap } from 'lucide-react';
import { formatDate } from '../../../lib/utils';

export default function CertificationsPage() {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [certs, setCerts] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>('/certifications/user');
      setCerts(data || []);
    } catch (e) {
      console.error('Failed to load certificates', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  const handleCopyLink = (hash: string, id: string) => {
    const origin = window.location.origin;
    const url = `${origin}/verify/${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-slate-800/40 pb-5">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Award className="w-6 h-6 text-indigo-400" />
          <span>{locale === 'ar' ? 'سجل الشهادات المعتمدة' : 'Verified Certifications Hub'}</span>
        </h2>
        <p className="text-xs text-slate-400">
          {locale === 'ar'
            ? 'اعرض وشارك شهادات إنجازك الأكاديمي الموقعة والمشفرة رقمياً.'
            : 'View and share your cryptographically signed achievements and milestones.'}
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Spinner className="w-8 h-8" />
        </div>
      ) : certs.length === 0 ? (
        <Card className="bg-slate-900/10 border border-slate-800/40 py-16 flex flex-col items-center justify-center gap-4 text-center max-w-xl mx-auto">
          <div className="bg-rose-500/10 p-5 rounded-full text-indigo-400">
            <Award className="w-12 h-12" />
          </div>
          <div className="flex flex-col gap-2 px-6">
            <h4 className="text-lg font-bold text-white">
              {locale === 'ar' ? 'لا توجد شهادات صادرة بعد' : 'No Certificates Issued Yet'}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {locale === 'ar'
                ? 'ستحصل على شهادة معتمدة فور إتمامك بنجاح لجميع المراحل والمشاريع التطبيقية في أي مسار دراسي.'
                : 'You will receive an official verifiable certification upon successfully completing all learning path stage projects.'}
            </p>
          </div>
          <Link href="/learning-paths" className="mt-2">
            <Button variant="primary" className="font-bold cursor-pointer">
              <span>{locale === 'ar' ? 'استكشف مسارات التعلم' : 'Explore Learning Paths'}</span>
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certs.map((cert) => (
            <Card key={cert.id} className="bg-slate-900/30 border-slate-800/40 hover:border-slate-700/60 p-5 flex flex-col justify-between gap-5 transition-all">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="bg-indigo-500/10 p-2.5 rounded-xl text-indigo-400">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <Badge variant="success" className="px-2.5 py-0.5 text-[9px] uppercase font-bold tracking-wider">
                    {locale === 'ar' ? 'موثقة' : 'Verified'}
                  </Badge>
                </div>

                <div className="flex flex-col gap-1 mt-1">
                  <h3 className="text-lg font-bold text-white line-clamp-1">
                    {cert.path.skillName}
                  </h3>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    {cert.path.difficultyLevel} {locale === 'ar' ? 'المستوى' : 'Level'}
                  </span>
                </div>

                <div className="flex flex-col gap-1 mt-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(cert.issuedAt, locale)}
                  </span>
                  <span className="font-mono text-[9px] text-slate-500 mt-2 truncate bg-slate-950 p-2 rounded border border-slate-900 leading-none">
                    {cert.certificateHash}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-slate-800/30 pt-4">
                <Link href={`/verify/${cert.certificateHash}`} target="_blank" className="flex-1">
                  <Button variant="secondary" className="w-full text-xs font-bold border-slate-800 text-slate-400 hover:text-white cursor-pointer py-2">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5 rtl:ml-1.5" />
                    <span>{locale === 'ar' ? 'عرض الشهادة' : 'View Credential'}</span>
                  </Button>
                </Link>
                <Button
                  onClick={() => handleCopyLink(cert.certificateHash, cert.id)}
                  variant="secondary"
                  className="px-3 border-slate-800 text-slate-400 hover:text-white cursor-pointer py-2"
                >
                  {copiedId === cert.id ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
