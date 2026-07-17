'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Trophy, Medal, Star, Crown, Loader2, RefreshCw } from 'lucide-react';
import { useLocale } from '../../../hooks/use-locale';
import { Spinner } from '../../../components/ui/spinner';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
}

const PODIUM_STYLES = [
  { bg: 'from-amber-500 to-yellow-400', border: 'border-amber-400/40', icon: Crown,  iconColor: 'text-amber-300', size: 'w-16 h-16', label: '1st' },
  { bg: 'from-slate-400 to-slate-300',  border: 'border-slate-400/30', icon: Medal,  iconColor: 'text-slate-300',  size: 'w-14 h-14', label: '2nd' },
  { bg: 'from-amber-700 to-amber-600',  border: 'border-amber-700/30', icon: Medal,  iconColor: 'text-amber-500',  size: 'w-12 h-12', label: '3rd' },
];

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="w-8 h-8 text-indigo-400" />
    </div>
  );
}

function Avatar({ entry, size = 'md' }: { entry: LeaderboardEntry; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  const initial = entry.displayName[0]?.toUpperCase() || '?';
  if (entry.avatarUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={entry.avatarUrl} alt={entry.displayName} className={`${dims} rounded-full object-cover border-2 border-white/20`} />
    );
  }
  return (
    <div className={`${dims} rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center font-bold text-white border-2 border-white/10`}>
      {initial}
    </div>
  );
}

export default function LeaderboardPage() {
  const { locale } = useLocale();
  const isRtl = locale === 'ar';

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/gamification/leaderboard?limit=20', { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : (data?.data ?? []));
    } catch {
      setError(isRtl ? 'فشل تحميل لوحة الصدارة' : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [isRtl]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  if (!entries || !Array.isArray(entries)) return <LoadingSpinner />;

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            {isRtl ? 'لوحة الصدارة' : 'Leaderboard'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isRtl
              ? 'أعلى الطلاب نقاطاً في المنصة — هل أنت من بينهم?'
              : 'Top students by XP on the platform — are you on the list?'}
          </p>
        </div>
        <button
          onClick={fetchLeaderboard}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800/50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {isRtl ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm">{error}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-24 text-slate-500">
          {isRtl ? 'لا يوجد بيانات بعد' : 'No data yet. Study to claim a spot!'}
        </div>
      ) : (
        <>
          {/* Podium — top 3 */}
          {podium.length >= 2 && (
            <div className="flex items-end justify-center gap-4 mb-12 pt-4">
              {/* 2nd */}
              {podium[1] && (
                <PodiumCard entry={podium[1]} style={PODIUM_STYLES[1]} isRtl={isRtl} height="h-36" />
              )}
              {/* 1st */}
              {podium[0] && (
                <PodiumCard entry={podium[0]} style={PODIUM_STYLES[0]} isRtl={isRtl} height="h-44" />
              )}
              {/* 3rd */}
              {podium[2] && (
                <PodiumCard entry={podium[2]} style={PODIUM_STYLES[2]} isRtl={isRtl} height="h-28" />
              )}
            </div>
          )}

          {/* Ranked list — 4th and beyond */}
          {rest.length > 0 && (
            <div className="glass rounded-2xl border border-slate-800/40 overflow-hidden">
              <div className="divide-y divide-slate-800/40">
                {rest.map((entry) => (
                  <div
                    key={entry.rank}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/20 transition-colors group"
                  >
                    {/* Rank */}
                    <span className="text-slate-500 text-sm font-mono w-6 text-center shrink-0">
                      {entry.rank}
                    </span>

                    <Avatar entry={entry} size="sm" />

                    {/* Name */}
                    <span className="flex-1 text-sm font-medium text-slate-200 truncate">
                      {entry.displayName}
                    </span>

                    {/* Level badge */}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-semibold shrink-0">
                      Lv {entry.level}
                    </span>

                    {/* XP */}
                    <div className="flex items-center gap-1 text-amber-400 text-sm font-semibold w-24 justify-end shrink-0">
                      <Star className="w-3.5 h-3.5" />
                      {entry.xp.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PodiumCard({ entry, style, isRtl, height }: {
  entry: LeaderboardEntry;
  style: typeof PODIUM_STYLES[0];
  isRtl: boolean;
  height: string;
}) {
  const Icon = style.icon;

  return (
    <div className="flex flex-col items-center gap-2 w-28">
      {/* Crown / Medal */}
      <Icon className={`w-6 h-6 ${style.iconColor}`} />

      {/* Avatar */}
      <div className={`relative`}>
        <Avatar entry={entry} size={entry.rank === 1 ? 'lg' : 'md'} />
        <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br ${style.bg} text-[10px] font-bold text-white flex items-center justify-center border-2 border-slate-900`}>
          {entry.rank}
        </span>
      </div>

      {/* Name */}
      <p className="text-xs font-semibold text-white text-center line-clamp-1 w-full px-1">{entry.displayName}</p>
      <p className="text-[10px] text-amber-400 font-medium">⭐ {entry.xp.toLocaleString()} XP</p>

      {/* Podium block */}
      <div className={`w-full ${height} rounded-t-xl bg-gradient-to-b ${style.bg} opacity-80 border ${style.border} flex items-start justify-center pt-2`}>
        <span className="text-xs font-bold text-white/80">{style.label}</span>
      </div>
    </div>
  );
}
