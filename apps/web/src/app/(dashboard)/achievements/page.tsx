'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useLocale } from '../../../hooks/use-locale';
import { Card } from '../../../components/ui/card';
import { Spinner } from '../../../components/ui/spinner';
import { Trophy, Crown, Sparkles, BookOpen, Code, Award, Calendar, Lock, Check } from 'lucide-react';
import { formatDate } from '../../../lib/utils';

interface BadgeItem {
  id: string;
  code: string;
  name: string;
  description: string;
  iconUrl: string;
  xpReward: number;
  isEarned: boolean;
  earnedAt?: string;
}

interface GamificationStatus {
  level: number;
  totalXp: number;
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
  progressPercentage: number;
}

export default function AchievementsPage() {
  const { t, locale, dir } = useLocale();
  const [status, setStatus] = useState<GamificationStatus | null>(null);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statusRes, badgesRes] = await Promise.all([
          api.get<GamificationStatus>('/gamification/status'),
          api.get<{ earned: any[]; all: BadgeItem[] }>('/gamification/badges'),
        ]);

        setStatus(statusRes);
        setBadges(badgesRes.all);
      } catch (err) {
        console.error('Failed to load achievements data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  const earnedBadgesCount = badges.filter((b) => b.isEarned).length;
  const totalBadgesCount = badges.length;

  // Resolve Lucide icons for badges dynamically
  const getBadgeIcon = (iconCode: string, isEarned: boolean) => {
    const className = `w-7 h-7 ${isEarned ? 'text-indigo-400 group-hover:scale-110' : 'text-slate-650'} transition-transform duration-300`;
    switch (iconCode) {
      case 'trophy': return <Trophy className={className} />;
      case 'crown': return <Crown className={className} />;
      case 'gem': return <Sparkles className={className} />;
      case 'book': return <BookOpen className={className} />;
      case 'code': return <Code className={className} />;
      default: return <Award className={className} />;
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Title Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
          <Trophy className="w-7 h-7 text-indigo-400" />
          <span>{t('achievements.title') || 'Achievements & Badges'}</span>
        </h2>
        <p className="text-slate-400 text-sm">
          {t('achievements.subtitle') || 'Track your learning milestones, earn XP, and level up!'}
        </p>
      </div>

      {/* Stats Summary Panel */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Level Stats Card */}
          <Card className="bg-slate-900/40 p-6 flex flex-col gap-3 relative overflow-hidden group">
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-indigo-500" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-400">
                {locale === 'ar' ? 'المستوى الحالي' : 'Current Level'}
              </span>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Crown className="w-5 h-5" />
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-3xl font-black text-white">
                {locale === 'ar' ? `المستوى ${status.level}` : `Level ${status.level}`}
              </span>
              <span className="text-xs text-slate-400 mt-1">
                {status.xpInCurrentLevel} / {status.xpNeededForNextLevel} XP {locale === 'ar' ? 'للمستوى التالي' : 'to next level'}
              </span>
            </div>
            {/* Custom progress bar */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2 border border-slate-800/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                style={{ width: `${status.progressPercentage}%` }}
              />
            </div>
          </Card>

          {/* Badges Count Card */}
          <Card className="bg-slate-900/40 p-6 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-500" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-400">
                {t('achievements.badgesCount') || 'Badges Unlocked'}
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Trophy className="w-5 h-5" />
              </div>
            </div>
            <div className="flex flex-col gap-0.5 mt-3">
              <span className="text-3xl font-black text-white">
                {earnedBadgesCount} / {totalBadgesCount}
              </span>
              <span className="text-xs text-slate-400 mt-1">
                {Math.round((earnedBadgesCount / Math.max(totalBadgesCount, 1)) * 100)}% {locale === 'ar' ? 'مكتمل' : 'Completed'}
              </span>
            </div>
          </Card>

          {/* Total XP Card */}
          <Card className="bg-slate-900/40 p-6 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-pink-500" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-400">
                {locale === 'ar' ? 'إجمالي نقاط الخبرة' : 'Total Experience Points'}
              </span>
              <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div className="flex flex-col gap-0.5 mt-3">
              <span className="text-3xl font-black text-white">
                {status.totalXp} XP
              </span>
              <span className="text-xs text-slate-400 mt-1">
                {locale === 'ar' ? 'اكتسب المزيد بالدراسة المستمرة' : 'Earn more by completing studies'}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Badges Grid */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-white">
          {t('achievements.allBadges') || 'All Badges'}
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {badges.map((badge) => (
            <Card
              key={badge.id}
              className={`p-5 flex gap-4 relative group transition-all duration-300 border ${
                badge.isEarned
                  ? 'bg-slate-900/40 border-slate-800/45 hover:border-indigo-500/30'
                  : 'bg-slate-950/20 border-slate-900/60 opacity-60'
              }`}
            >
              {/* Badge Icon Circular Display */}
              <div className="relative shrink-0 flex items-center justify-center">
                {badge.isEarned && (
                  <div className="absolute w-14 h-14 rounded-full bg-indigo-500/10 blur-md group-hover:opacity-100 transition-opacity" />
                )}
                <div
                  className={`w-14 h-14 rounded-full border flex items-center justify-center transition-colors duration-300 ${
                    badge.isEarned
                      ? 'bg-indigo-500/5 border-indigo-500/25 group-hover:border-indigo-500/40'
                      : 'bg-slate-950/40 border-slate-850 text-slate-500'
                  }`}
                >
                  {getBadgeIcon(badge.iconUrl, badge.isEarned)}
                </div>
                {badge.isEarned && (
                  <div className="absolute -bottom-1.5 -right-1 bg-indigo-500 text-white rounded-full p-0.5 border-2 border-slate-950 shadow-md">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Badge Details */}
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className={`text-sm font-bold truncate group-hover:text-white transition-colors ${
                    badge.isEarned ? 'text-slate-100' : 'text-slate-450'
                  }`}>
                    {badge.name}
                  </h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    badge.isEarned
                      ? 'bg-indigo-500/10 text-indigo-400'
                      : 'bg-slate-950/40 text-slate-500 border border-slate-800'
                  }`}>
                    +{badge.xpReward} XP
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-normal line-clamp-2">
                  {badge.description}
                </p>

                {badge.isEarned && badge.earnedAt && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {t('achievements.earned') || 'Earned'}: {formatDate(badge.earnedAt, locale)}
                    </span>
                  </div>
                )}
                
                {!badge.isEarned && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-600 mt-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>{t('achievements.locked') || 'Locked'}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
