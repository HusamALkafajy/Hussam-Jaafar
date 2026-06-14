'use client';

import React, { useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useLocale } from '../../../hooks/use-locale';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { api } from '../../../lib/api';
import { User, Lock, Globe, CheckCircle, AlertTriangle } from 'lucide-react';

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
