'use client';

import React, { useEffect, useState, use } from 'react';
import { api } from '../../../lib/api';
import { useLocale } from '../../../hooks/use-locale';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Spinner } from '../../../components/ui/spinner';
import { Award, ShieldCheck, CheckCircle2, AlertTriangle, Calendar, FileText, Globe } from 'lucide-react';
import { formatDate } from '../../../lib/utils';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ hash: string }>;
}

export default function PublicCertificateVerificationPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const hash = resolvedParams.hash;
  const { locale, dir } = useLocale();

  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      try {
        const result = await api.get<any>(`/certifications/verify/${hash}`);
        setCert(result);
      } catch (err: any) {
        setError(err.message || 'Certification invalid or expired.');
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [hash]);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#060913] text-slate-100">
        <Spinner className="w-10 h-10 border-4 text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#050811] text-slate-100 flex flex-col items-center justify-center p-4" dir={dir}>
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-indigo-500/5 via-purple-500/2 to-transparent pointer-events-none" />

      {error || !cert ? (
        <Card className="w-full max-w-md bg-slate-900 border-slate-800 p-8 flex flex-col items-center gap-5 text-center shadow-2xl relative z-10">
          <div className="bg-rose-500/10 p-4 rounded-full text-rose-400">
            <AlertTriangle className="w-10 h-10 animate-pulse" />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-bold text-white">
              {locale === 'ar' ? 'شهادة غير صالحة' : 'Invalid Certificate Credential'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {locale === 'ar'
                ? 'رمز الشهادة المدخل غير صالح، أو قد تم تعديله أو إبطاله من قبل النظام.'
                : 'The cryptographic hash provided does not match any certificate in our registry.'}
            </p>
          </div>
          <div className="w-full font-mono text-[9px] bg-slate-950 p-2 border border-slate-850 text-slate-500 rounded break-words select-all leading-relaxed">
            {hash}
          </div>
          <Link href="/" className="mt-2 w-full">
            <button className="w-full py-2 border border-slate-850 hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer transition-colors text-slate-300">
              {locale === 'ar' ? 'العودة للرئيسية' : 'Go to StudyAI'}
            </button>
          </Link>
        </Card>
      ) : (
        <div className="w-full max-w-2xl flex flex-col gap-6 relative z-10">
          {/* Certificate visual card container */}
          <Card className="bg-slate-900/50 border border-slate-800/80 p-8 sm:p-12 relative overflow-hidden shadow-2xl rounded-2xl">
            {/* Elegant framing border */}
            <div className="absolute inset-4 border border-indigo-500/10 rounded-xl pointer-events-none" />

            {/* Verification Stamp badge top-right */}
            <div className="absolute top-6 right-6 sm:top-10 sm:right-10 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <Badge variant="success" className="px-2.5 py-0.5 text-[9px] uppercase font-bold tracking-wider">
                {locale === 'ar' ? 'شهادة موثقة' : 'Verified'}
              </Badge>
            </div>

            {/* Certificate content layout */}
            <div className="flex flex-col items-center text-center gap-8 pt-4 sm:pt-6">
              {/* Gold Graduation Cup */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500/20 to-indigo-500/10 flex items-center justify-center border border-amber-500/30 text-amber-400">
                  <Award className="w-8 h-8" />
                </div>
                <div className="absolute -inset-1 bg-amber-500/20 rounded-full filter blur-md opacity-30 animate-pulse pointer-events-none" />
              </div>

              {/* Title blocks */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] sm:text-xs text-indigo-400 uppercase font-black tracking-widest leading-none">
                  {locale === 'ar' ? 'شهادة إتمام معتمدة' : 'Official Certificate of Completion'}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  {locale === 'ar' ? 'منصة الدراسة الذكية - StudyAI' : 'StudyAI Learning Platform'}
                </h2>
              </div>

              {/* Recipient details */}
              <div className="flex flex-col gap-1 w-full max-w-md py-4 border-y border-slate-800/35 relative">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  {locale === 'ar' ? 'تُمنح هذه الشهادة بفخر لـ' : 'This credential is proudly presented to'}
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white py-1">
                  {cert.recipientName}
                </span>
                <p className="text-xs text-slate-400 leading-relaxed px-4">
                  {locale === 'ar'
                    ? `لإتمامه بنجاح كافة المراحل والمشاريع التطبيقية واختبارات التقييم بالذكاء الاصطناعي للمهارة الموضحة أدناه بمستوى ${cert.difficultyLevel}.`
                    : `for successfully mastering all stages, assignments, and AI tutor evaluations for the specified skill roadmap at ${cert.difficultyLevel} level.`}
                </p>
              </div>

              {/* Certified Skill name */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  {locale === 'ar' ? 'المهارة المكتسبة' : 'Skill Credential'}
                </span>
                <span className="text-lg sm:text-xl font-bold text-white bg-slate-950 px-5 py-2 rounded-xl border border-slate-850/60 shadow-inner">
                  {cert.skillName}
                </span>
              </div>

              {/* Footer info (date, sign) */}
              <div className="grid grid-cols-2 gap-x-12 w-full max-w-md text-xs text-slate-400 border-t border-slate-800/10 pt-5">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">{locale === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}</span>
                  <span className="text-white font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {formatDate(cert.issuedAt, locale)}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">{locale === 'ar' ? 'توقيع المنصة' : 'Signature'}</span>
                  <span className="text-emerald-400 font-extrabold flex items-center gap-1 select-none font-serif tracking-wide italic">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>StudyAI Tutor</span>
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Cryptographic hash display */}
          <Card className="bg-slate-900/20 border-slate-800/30 p-4 flex flex-col gap-2 relative overflow-hidden">
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
              <FileText className="w-3.5 h-3.5" />
              <span>{locale === 'ar' ? 'البصمة الرقمية للشهادة' : 'Cryptographic Verification Stamp'}</span>
            </div>
            <div className="font-mono text-[9px] sm:text-xs text-slate-400 select-all p-2 rounded bg-slate-950 border border-slate-850 break-all leading-normal text-center">
              {cert.certificateHash}
            </div>
            <div className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
              <Globe className="w-3 h-3 text-slate-600" />
              <span>
                {locale === 'ar'
                  ? 'تم التحقق من هذه الشهادة وتوقيعها رقمياً ضد قاعدة بيانات StudyAI.'
                  : 'This credential has been successfully verified against the StudyAI secure registry.'}
              </span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
