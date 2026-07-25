'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/use-auth';
import { useLocale } from '../../../hooks/use-locale';
import { useSearchParams } from 'next/navigation';
import { Input } from '../../../components/ui/input';
import { Button, buttonVariants } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Mail, Lock, User, AlertCircle, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError(t('common.required'));
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register({
        email,
        password,
        firstName,
        lastName,
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-8">
      <div className="flex flex-col gap-2 text-center mb-6">
        <h2 className="text-2xl font-bold text-white">{t('common.register')}</h2>
        {plan === 'pro' ? (
          <div className="mt-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center gap-3 text-start">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 shrink-0">
              <Crown className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-300">أنت على بُعد خطوة واحدة من Pro ✨</p>
              <p className="text-[11px] text-slate-400 mt-0.5">أنشئ حسابك وسنحولك مباشرةً لإتمام الاشتراك عبر Stripe.</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">انضم إلينا مجاناً وابدأ التعلم الذكي</p>
        )}
      </div>

      {error && (
        <div 
          role="alert" 
          aria-live="polite" 
          className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            id="firstName"
            type="text"
            label={t('auth.firstName')}
            placeholder="John"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            icon={<User className="w-4 h-4" aria-hidden="true" />}
            required
            aria-invalid={error ? 'true' : 'false'}
          />
          <Input
            id="lastName"
            type="text"
            label={t('auth.lastName')}
            placeholder="Doe"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            icon={<User className="w-4 h-4" aria-hidden="true" />}
            required
            aria-invalid={error ? 'true' : 'false'}
          />
        </div>

        <Input
          id="email"
          type="email"
          label={t('auth.email')}
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail className="w-4 h-4" aria-hidden="true" />}
          required
          aria-invalid={error ? 'true' : 'false'}
        />

        <Input
          id="password"
          type="password"
          label={t('auth.password')}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock className="w-4 h-4" aria-hidden="true" />}
          required
          aria-invalid={error ? 'true' : 'false'}
        />

        <Input
          id="confirmPassword"
          type="password"
          label={t('auth.confirmPassword')}
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          icon={<Lock className="w-4 h-4" aria-hidden="true" />}
          required
          aria-invalid={error ? 'true' : 'false'}
        />

        <Button type="submit" loading={loading} className="w-full mt-2 font-bold py-2.5">
          {t('common.register')}
        </Button>
      </form>

      <div className="relative my-6 text-center">
        <hr className="border-slate-800" />
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0F172A] px-3 text-xs text-slate-500 uppercase">
          {t('auth.or')}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <a href="http://localhost:4000/api/auth/google" className={cn(buttonVariants({ variant: 'outline' }), "gap-2.5 bg-white hover:bg-slate-100 text-slate-900 border-none shadow-md")}>
          {/* Simple SVG Google Logo */}
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 018 12.5a5.99 5.99 0 015.99-6.014c1.49 0 2.846.55 3.9 1.455l3.14-3.14A9.957 9.957 0 0013.99 2 9.99 9.99 0 004 12a9.99 9.99 0 009.99 10c5.52 0 10.01-4.48 10.01-10 0-.685-.06-1.354-.17-2.014H12.24z"
            />
          </svg>
          <span>{t('auth.registerWithGoogle')}</span>
        </a>

        <a href="http://localhost:4000/api/auth/apple" className={cn(buttonVariants({ variant: 'outline' }), "gap-2.5 bg-slate-900 border-slate-800 hover:bg-slate-850 hover:text-white text-white shadow-md")}>
          {/* Simple Apple Icon */}
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.1.09 2.23-.58 2.95-1.39z" />
          </svg>
          <span>{t('auth.registerWithApple')}</span>
        </a>
      </div>

      <div className="mt-8 text-center text-sm">
        <Link href="/login" className="text-indigo-400 hover:underline">
          {t('auth.alreadyHaveAccount')}
        </Link>
      </div>
    </Card>
  );
}
