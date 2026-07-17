'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from '../../../hooks/use-locale';
import { api } from '../../../lib/api-client';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ResetPasswordPage() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Invalid or missing reset token.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    if (!password || !confirmPassword) {
      setErrorMessage(t('common.required') || 'Both fields are required');
      setStatus('error');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      setStatus('error');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      await api.post('/auth/reset-password', { token, newPassword: password }, { signal: controller.signal });
      clearTimeout(timeoutId);
      setStatus('success');
    } catch (err: any) {
      clearTimeout(timeoutId);
      setStatus('error');
      
      if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
        setErrorMessage('Request timed out. Please try again.');
      } else if (err.response?.status === 429) {
        setErrorMessage('Too many requests. Please wait a moment and try again.');
      } else if (err.response?.status === 400 || err.response?.status === 401) {
        setErrorMessage('Invalid or expired reset token. Please request a new one.');
      } else {
        setErrorMessage(err.response?.data?.message || err.message || 'Failed to reset password');
      }
    }
  };

  if (status === 'success') {
    return (
      <Card className="p-8 text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Password Reset Successful</h2>
        <p className="text-sm text-slate-400 mb-6">
          Your password has been updated. You can now sign in with your new password.
        </p>
        <Button onClick={() => router.push('/login')} className="w-full font-bold">
          Go to Login
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <div className="flex flex-col gap-2 text-center mb-6">
        <h2 className="text-2xl font-bold text-white">Create New Password</h2>
        <p className="text-sm text-slate-400">Enter your new password below.</p>
      </div>

      {status === 'error' && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span>{errorMessage}</span>
            {(errorMessage.includes('token') || errorMessage.includes('expired')) && (
              <Link href="/forgot-password" className="text-rose-300 hover:underline mt-1 font-medium">
                Request a new link
              </Link>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            label="New Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (status === 'error') setStatus('idle');
            }}
            icon={<Lock className="w-4 h-4" />}
            disabled={status === 'loading' || !token}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 bottom-3 text-slate-500 hover:text-slate-300 transition-colors"
            disabled={status === 'loading' || !token}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="relative">
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            label="Confirm Password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (status === 'error') setStatus('idle');
            }}
            icon={<Lock className="w-4 h-4" />}
            disabled={status === 'loading' || !token}
            required
          />
        </div>

        <Button type="submit" loading={status === 'loading'} disabled={status === 'loading' || !token} className="w-full mt-2 font-bold py-2.5">
          Reset Password
        </Button>
      </form>

      <div className="mt-8 text-center text-sm">
        <Link href="/login" className="flex items-center justify-center gap-2 text-slate-400 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>
      </div>
    </Card>
  );
}
