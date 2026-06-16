'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useLocale } from '../hooks/use-locale';
import { Trophy, Star, Sparkles } from 'lucide-react';

interface GamificationStatus {
  level: number;
  totalXp: number;
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
  progressPercentage: number;
}

export function GamificationWidget({ sidebarOpen }: { sidebarOpen: boolean }) {
  const { t, locale } = useLocale();
  const [status, setStatus] = useState<GamificationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const data = await api.get<GamificationStatus>('/gamification/status');
        setStatus(data);
      } catch (err) {
        console.error('Failed to fetch gamification status', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchStatus();

    // Listen to real-time updates from lesson completion/project submission
    const handleGamificationUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const { level, totalXp, xpInCurrentLevel, xpNeededForNextLevel, progressPercentage } = customEvent.detail;
        setStatus({
          level,
          totalXp,
          xpInCurrentLevel,
          xpNeededForNextLevel,
          progressPercentage,
        });
      }
    };

    window.addEventListener('gamification-update', handleGamificationUpdate);
    return () => {
      window.removeEventListener('gamification-update', handleGamificationUpdate);
    };
  }, []);

  if (loading) {
    return (
      <div className={`w-full bg-slate-900/30 border border-slate-800/40 rounded-xl animate-pulse ${sidebarOpen ? 'p-4 h-24' : 'w-12 h-12 rounded-full mx-auto'}`} />
    );
  }

  if (!status) return null;

  if (!sidebarOpen) {
    // Collapsed version
    return (
      <div className="relative group flex justify-center py-2">
        <div className="w-11 h-11 rounded-full border border-indigo-500/40 flex items-center justify-center bg-slate-900/60 shadow-[0_0_12px_rgba(99,102,241,0.15)] hover:border-indigo-400 hover:shadow-[0_0_16px_rgba(99,102,241,0.3)] transition-all duration-300 cursor-pointer">
          <span className="text-xs font-black text-indigo-300 select-none">
            L{status.level}
          </span>
        </div>
        
        {/* Tooltip detail on hover */}
        <div className="absolute left-16 top-1/2 -translate-y-1/2 scale-0 group-hover:scale-100 bg-slate-950 border border-slate-800 text-slate-100 text-xs px-3 py-2 rounded-lg shadow-xl transition-all duration-200 z-50 whitespace-nowrap flex flex-col gap-1.5 min-w-[120px]">
          <div className="flex items-center gap-1.5 font-bold text-indigo-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{locale === 'ar' ? `المستوى ${status.level}` : `Level ${status.level}`}</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {status.totalXp} XP total
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-500 h-full rounded-full" 
              style={{ width: `${status.progressPercentage}%` }} 
            />
          </div>
          <div className="text-[9px] text-slate-500 text-right">
            {status.progressPercentage}%
          </div>
        </div>
      </div>
    );
  }

  // Expanded version
  return (
    <div className="w-full bg-slate-900/50 backdrop-blur-md border border-slate-800/60 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-md group hover:border-indigo-500/20 transition-all duration-300">
      {/* Title & Level */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform duration-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 leading-tight">
              {locale === 'ar' ? 'المستوى الحالي' : 'Current Level'}
            </span>
            <span className="text-sm font-bold text-white leading-tight">
              {locale === 'ar' ? `المستوى ${status.level}` : `Level ${status.level}`}
            </span>
          </div>
        </div>
        <div className="text-right flex flex-col">
          <span className="text-[10px] text-slate-500">
            {locale === 'ar' ? 'مجموع النقاط' : 'Total XP'}
          </span>
          <span className="text-xs font-black text-indigo-300">
            {status.totalXp} XP
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex flex-col gap-1">
        <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden border border-slate-800/40">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
            style={{ width: `${status.progressPercentage}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-400 px-0.5">
          <span>
            {status.xpInCurrentLevel} / {status.xpNeededForNextLevel} XP
          </span>
          <span className="font-bold text-slate-300">
            {status.progressPercentage}%
          </span>
        </div>
      </div>
    </div>
  );
}
