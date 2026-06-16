'use client';

import React, { useEffect, useState } from 'react';
import { useLocale } from '../hooks/use-locale';
import { Sparkles, Trophy, Award, Crown, X } from 'lucide-react';

interface ToastMessage {
  id: string;
  title: string;
  description: string;
  xp?: number;
  badgeCode?: string;
  badgeName?: string;
}

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  rotation: number;
}

export function GamificationCelebration() {
  const { t, locale, dir } = useLocale();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpNumber, setLevelUpNumber] = useState(1);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerConfetti = () => {
    const colors = ['#818cf8', '#a78bfa', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];
    const pieces: ConfettiPiece[] = Array.from({ length: 90 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 600,
      duration: Math.random() * 2000 + 2000,
      rotation: Math.random() * 360,
    }));
    setConfettiPieces(pieces);
    setShowConfetti(true);

    // Turn off confetti after 6 seconds to clean up DOM
    setTimeout(() => {
      setShowConfetti(false);
    }, 6000);
  };

  useEffect(() => {
    const handleGamificationEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail) return;

      const { xpEarned, hasLeveledUp, level, awardedBadge } = customEvent.detail;

      // 1. Show XP Gain Toast
      if (xpEarned && xpEarned > 0) {
        const id = Math.random().toString(36).substring(2, 9);
        const xpMessage = locale === 'ar' 
          ? `كسبت +${xpEarned} نقطة خبرة!` 
          : `Gained +${xpEarned} XP!`;
        
        setToasts((prev) => [
          ...prev,
          {
            id,
            title: locale === 'ar' ? 'نقاط خبرة إضافية' : 'XP Earned',
            description: xpMessage,
            xp: xpEarned,
          },
        ]);

        // Auto remove toast
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
      }

      // 2. Show Badge Unlocked Toast
      if (awardedBadge) {
        const id = Math.random().toString(36).substring(2, 9);
        const badgeTitle = locale === 'ar' ? 'تم فتح وسام جديد!' : 'Badge Unlocked!';
        const badgeDesc = locale === 'ar'
          ? `تهانينا! لقد حصلت على وسام "${awardedBadge.name}" (+${awardedBadge.xpReward} نقطة خبرة)`
          : `Congratulations! You unlocked "${awardedBadge.name}" (+${awardedBadge.xpReward} XP)`;

        setToasts((prev) => [
          ...prev,
          {
            id,
            title: badgeTitle,
            description: badgeDesc,
            badgeCode: awardedBadge.code,
            badgeName: awardedBadge.name,
          },
        ]);

        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
      }

      // 3. Handle Level Up Modal and Confetti
      if (hasLeveledUp && level) {
        setLevelUpNumber(level);
        setShowLevelUp(true);
        triggerConfetti();
      }
    };

    window.addEventListener('gamification-update', handleGamificationEvent);
    return () => {
      window.removeEventListener('gamification-update', handleGamificationEvent);
    };
  }, [locale]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <>
      {/* CSS Confetti Overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {confettiPieces.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-sm animate-fall"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.color,
                transform: `rotate(${p.rotation}deg)`,
                opacity: 0.85,
                animationDelay: `${p.delay}ms`,
                animationDuration: `${p.duration}ms`,
                animationIterationCount: 1,
                animationFillMode: 'forwards',
              }}
            />
          ))}
          <style jsx global>{`
            @keyframes fall {
              0% {
                transform: translateY(0) rotate(0deg);
                opacity: 1;
              }
              100% {
                transform: translateY(115vh) rotate(720deg);
                opacity: 0;
              }
            }
            .animate-fall {
              animation-name: fall;
              animation-timing-function: linear;
            }
          `}</style>
        </div>
      )}

      {/* Level Up Modal */}
      {showLevelUp && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0b0f19]/90 border border-indigo-500/30 rounded-2xl p-8 max-w-sm w-full flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(99,102,241,0.25)] relative overflow-hidden text-center animate-scale-up">
            {/* Ambient Background Glow */}
            <div className="absolute -top-20 -left-20 w-44 h-44 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-44 h-44 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />

            {/* Glowing Icon Crown */}
            <div className="relative flex items-center justify-center">
              <div className="absolute w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 blur-xl opacity-30 animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-slate-900 border-2 border-indigo-500/50 flex items-center justify-center text-white">
                <Crown className="w-10 h-10 text-yellow-400 animate-bounce" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <h2 className="text-2xl font-black uppercase tracking-wider bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {t('achievements.levelUp') || 'Level Up!'}
              </h2>
              <p className="text-slate-300 text-sm">
                {(t('achievements.levelUpDesc') || 'Congratulations! You reached Level {level}!').replace('{level}', levelUpNumber.toString())}
              </p>
            </div>

            {/* Big Level Display Badge */}
            <div className="px-6 py-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
              <span className="font-black text-xl text-white">
                {locale === 'ar' ? `المستوى ${levelUpNumber}` : `Level ${levelUpNumber}`}
              </span>
              <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
            </div>

            <button
              onClick={() => setShowLevelUp(false)}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-95 cursor-pointer"
            >
              {t('achievements.close') || 'Heck yeah!'}
            </button>
          </div>
          <style jsx>{`
            .animate-fade-in {
              animation: fadeIn 0.3s ease-out forwards;
            }
            .animate-scale-up {
              animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleUp {
              from { transform: scale(0.9); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* Floating Toast Containers */}
      <div 
        className={`fixed bottom-5 z-50 flex flex-col gap-3 max-w-sm w-full px-4 transition-all duration-300 ${
          dir === 'rtl' ? 'left-0' : 'right-0'
        }`}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="w-full glass bg-slate-950/70 border border-indigo-500/30 backdrop-blur-md rounded-xl p-4 shadow-xl flex items-start gap-3 relative overflow-hidden transition-all duration-300 hover:border-indigo-400 group animate-slide-in-toast"
          >
            {/* Indicator color block */}
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-indigo-500 to-pink-500" />
            
            <div className="flex-1 flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                {toast.badgeCode ? (
                  <Trophy className="w-4 h-4 text-yellow-400" />
                ) : (
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                )}
                <span className="text-xs font-bold text-white leading-none">
                  {toast.title}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium leading-normal mt-1">
                {toast.description}
              </p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800/40 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <style jsx>{`
          .animate-slide-in-toast {
            animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          @keyframes slideIn {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </>
  );
}
