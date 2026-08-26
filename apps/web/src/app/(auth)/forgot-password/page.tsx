'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLocale } from '../../../hooks/use-locale';
import { api } from '../../../lib/api-client';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage(t('common.required'));
      setStatus('error');
      return;
    }
    
    // Basic email validation
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setErrorMessage(t('auth.invalidEmail'));
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      await api.post('/auth/forgot-password', { email }, { signal: controller.signal });
      clearTimeout(timeoutId);
      setStatus('success');
    } catch (err: any) {
      clearTimeout(timeoutId);
      setStatus('error');
      
      // Async Safety Rule: Handle specific statuses
      if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
        setErrorMessage(t('auth.requestTimeout'));
      } else if (err.response?.status === 429) {
        setErrorMessage(t('auth.tooManyRequests'));
      } else {
        setErrorMessage(t('auth.resetRequestFailed'));
      }
    }
  };

  if (status === 'success') {
    return (
      <Card className="p-8 text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('auth.checkEmail')}</h2>
        <p className="text-sm text-slate-400 mb-6">
          {t('auth.resetEmailSent', { email })}
        </p>
        <Link href="/login" className="flex items-center justify-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          {t('auth.backToLogin')}
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <div className="flex flex-col gap-2 text-center mb-6">
        <h2 className="text-2xl font-bold text-white">{t('auth.resetPassword')}</h2>
        <p className="text-sm text-slate-400">{t('auth.resetPasswordDescription')}</p>
      </div>

      {status === 'error' && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="email"
          type="email"
          label={t('auth.email')}
          placeholder="name@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === 'error') setStatus('idle');
          }}
          icon={<Mail className="w-4 h-4" />}
          disabled={status === 'loading'}
          required
        />

        <Button type="submit" loading={status === 'loading'} disabled={status === 'loading'} className="w-full mt-2 font-bold py-2.5">
          {t('auth.sendResetLink')}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm">
        <Link href="/login" className="flex items-center justify-center gap-2 text-slate-400 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t('auth.backToLogin')}
        </Link>
      </div>
    </Card>
  );
}
