'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useLocale } from '../../../hooks/use-locale';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { api } from '../../../lib/api-client';
import {
  User,
  Lock,
  Globe,
  CreditCard,
  Crown,
  Zap,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, checkSession } = useAuth();
  const { t, locale, setLocale } = useLocale();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Billing state
  const [subscription, setSubscription] = useState<any | null>(null);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => {
    api.get<any>('/subscriptions/current')
      .then((data) => setSubscription(data))
      .catch(console.error);
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileSuccess(false);
    try {
      await api.patch('/users/profile', { firstName, lastName });
      setProfileSuccess(true);
      await checkSession();
    } catch (err) {
      alert('Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordSuccess(false);
    setPasswordError(null);
    try {
      await api.patch('/users/password', { oldPassword, newPassword });
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Password update failed');
    } finally {
      setPasswordLoading(false);
    }
  };

  const toggleLanguage = () => {
    const next = locale === 'ar' ? 'en' : 'ar';
    setLocale(next);
    // Persist to backend if user profile loaded
    api.patch('/users/locale', { locale: next }).catch(console.error);
  };

  const handleManageBilling = async () => {
    setBillingError(null);
    setBillingLoading('portal');
    try {
      const data = await api.post<{ portalUrl: string }>('/subscriptions/portal');
      window.location.href = data.portalUrl;
    } catch (err: any) {
      setBillingError(err.message || 'Failed to open billing portal. Please try again.');
    } finally {
      setBillingLoading(null);
    }
  };

  const handleUpgradeToPro = async () => {
    setBillingError(null);
    setBillingLoading('checkout');
    try {
      const data = await api.post<{ checkoutUrl: string }>('/subscriptions/checkout', { plan: 'pro' });
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setBillingError(err.message || 'Failed to start checkout. Please try again.');
    } finally {
      setBillingLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Sidebar options */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-white">{t('dashboard.sidebarSettings')}</h2>
        <p className="text-sm text-slate-400">تعديل الملف الشخصي، الأمان، وإعدادات اللغة المخصصة.</p>
      </div>

      <div className="lg:col-span-2 flex flex-col gap-8">
        {/* Profile details card */}
        <Card className="p-6 bg-slate-900/40">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            <span>تعديل الملف الشخصي</span>
          </h3>

          {profileSuccess && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>تم تحديث الملف الشخصي بنجاح</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="firstName"
                label="الاسم الأول"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <Input
                id="lastName"
                label="الاسم الأخير"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            <Button type="submit" loading={profileLoading} className="self-end mt-2 font-bold px-6">
              {t('common.save')}
            </Button>
          </form>
        </Card>

        {/* Change password card */}
        <Card className="p-6 bg-slate-900/40">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-400" />
            <span>تغيير كلمة المرور</span>
          </h3>

          {passwordSuccess && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>تم تغيير كلمة المرور بنجاح</span>
            </div>
          )}

          {passwordError && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <Input
              id="oldPassword"
              type="password"
              label="كلمة المرور القديمة"
              placeholder="••••••••"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
            <Input
              id="newPassword"
              type="password"
              label="كلمة المرور الجديدة"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            <Button type="submit" loading={passwordLoading} className="self-end mt-2 font-bold px-6">
              <span>تحديث الأمان</span>
            </Button>
          </form>
        </Card>

        {/* Billing & Subscription card */}
        <Card className="p-6 bg-slate-900/40">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <span>الفوترة والاشتراك</span>
          </h3>

          {billingError && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{billingError}</span>
            </div>
          )}

          <div className="flex flex-col gap-5">
            {/* Current plan indicator */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-800/60">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  subscription?.plan === 'pro'
                    ? 'bg-indigo-500/15 border border-indigo-500/20'
                    : 'bg-slate-700/40 border border-slate-700/40'
                }`}>
                  {subscription?.plan === 'pro' || subscription?.plan === 'institution' ? (
                    <Crown className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Zap className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {subscription?.plan === 'pro'
                      ? 'باقة Pro'
                      : subscription?.plan === 'institution'
                      ? 'باقة المؤسسات'
                      : 'الباقة المجانية'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {subscription?.currentPeriodEnd
                      ? `تنتهي في ${new Date(subscription.currentPeriodEnd).toLocaleDateString('ar-EG')}`
                      : 'غير محدودة'}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                subscription?.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-slate-700/40 text-slate-400'
              }`}>
                {subscription?.status === 'active' ? 'نشط' : subscription?.status ?? '—'}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Manage Billing — only shown if user has a Stripe subscription */}
              {subscription?.stripeCustomerId && (
                <Button
                  variant="secondary"
                  onClick={handleManageBilling}
                  disabled={billingLoading === 'portal'}
                  className="flex items-center gap-2 font-semibold"
                >
                  {billingLoading === 'portal' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  <span>إدارة الفوترة عبر Stripe</span>
                </Button>
              )}

              {/* Upgrade button — only shown for free plan users */}
              {(!subscription || subscription.plan === 'free') && (
                <Button
                  onClick={handleUpgradeToPro}
                  disabled={billingLoading === 'checkout'}
                  className="flex items-center gap-2 font-bold"
                >
                  {billingLoading === 'checkout' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Crown className="w-4 h-4" />
                  )}
                  <span>الترقية إلى Pro</span>
                </Button>
              )}
            </div>

            <p className="text-xs text-slate-600">
              لإلغاء الاشتراك أو تغيير طريقة الدفع، استخدم بوابة Stripe أعلاه.
            </p>
          </div>
        </Card>

        {/* Preferences settings card */}
        <Card className="p-6 bg-slate-900/40 flex flex-col gap-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            <span>تفضيلات اللغة والمظهر</span>
          </h3>

          <div className="flex items-center justify-between border-t border-slate-800/30 pt-4 text-sm">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-slate-200">لغة الواجهة</span>
              <span className="text-xs text-slate-500">اختر اللغة المناسبة لتصفح المنصة الدراسية.</span>
            </div>

            <Button onClick={toggleLanguage} variant="secondary" size="sm">
              {locale === 'ar' ? 'English' : 'العربية'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
