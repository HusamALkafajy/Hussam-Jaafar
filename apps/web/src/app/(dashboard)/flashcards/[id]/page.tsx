'use client';

import React, { useEffect, useState, use } from 'react';
import { api } from '../../../../lib/api-client';
import { useLocale } from '../../../../hooks/use-locale';
import { Card } from '../../../../components/ui/card';
import { Button, buttonVariants } from '../../../../components/ui/button';
import { Spinner } from '../../../../components/ui/spinner';
import { HelpCircle, RefreshCw, CheckCircle, ArrowRight, Award, Compass, HelpCircle as HelpIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '../../../../lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function FlashcardReviewPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const setId = resolvedParams.id;
  const { t, locale } = useLocale();

  const [loading, setLoading] = useState(true);
  const [set, setSet] = useState<any | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewCompleted, setReviewCompleted] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Statistics trackers for this session
  const [masteredCount, setMasteredCount] = useState(0);
  const [learningCount, setLearningCount] = useState(0);
  const [reviewingCount, setReviewingCount] = useState(0);

  useEffect(() => {
    const fetchSet = async () => {
      setLoading(true);
      try {
        const data = await api.get<any>(`/flashcard-sets/${setId}`);
        setSet(data);
        setMasteredCount(data.masteredCount || 0);
      } catch (e) {
        console.error('Failed to load flashcard set', e);
      } finally {
        setLoading(false);
      }
    };

    fetchSet();
  }, [setId]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!set || !set.cards || set.cards.length === 0) {
    return (
      <div className="text-center py-12 flex flex-col items-center gap-3">
        <p className="text-slate-400">{t('flashcards.noCards')}</p>
        <Button nativeButton={false} render={<Link href="/flashcards" />}>
          {t('flashcards.backToSets')}
        </Button>
      </div>
    );
  }

  const currentCard = set.cards[currentIndex];

  const handleReview = async (masteryLevel: 'learning' | 'reviewing' | 'mastered') => {
    if (submittingReview) return;
    setSubmittingReview(true);

    try {
      // API call to record card review scheduling
      const updatedSet = await api.patch<any>(`/flashcards/${currentCard.id}/review`, {
        masteryLevel,
      });

      // Update set data and session stats
      setSet(updatedSet);
      if (masteryLevel === 'mastered') setMasteredCount((prev) => prev + 1);
      else if (masteryLevel === 'learning') setLearningCount((prev) => prev + 1);
      else if (masteryLevel === 'reviewing') setReviewingCount((prev) => prev + 1);

      // Move to next card
      if (currentIndex + 1 < set.cards.length) {
        setIsFlipped(false);
        // Add a tiny delay to allow the card to flip back before changing text
        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          setSubmittingReview(false);
        }, 250);
      } else {
        setReviewCompleted(true);
        setSubmittingReview(false);
      }
    } catch {
      alert(t('flashcards.reviewFailure'));
      setSubmittingReview(false);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewCompleted(false);
    setLearningCount(0);
    setReviewingCount(0);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/40 pb-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/files/${set.fileId}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), "rounded-lg border-slate-800 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer")}
          >
            <ArrowRight className="w-4 h-4 rtl-flip" />
          </Link>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-white line-clamp-1">{set.title}</h2>
            <p className="text-xs text-slate-400">
              {t('flashcards.spacedRepetition')}
            </p>
          </div>
        </div>

        {!reviewCompleted && (
          <span className="text-sm font-bold text-slate-400 bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-full">
            {currentIndex + 1} / {set.cards.length}
          </span>
        )}
      </div>

      {reviewCompleted ? (
        /* ================= DECK COMPLETED VIEW ================= */
        <Card className="p-8 text-center flex flex-col items-center gap-6 bg-slate-900/10 border-slate-800/60 relative overflow-hidden animate-fade-in">
          <div className="absolute top-0 left-0 w-full h-1.5 gradient-primary" />
          
          <div className="bg-emerald-500/10 p-5 rounded-full text-emerald-400 text-3xl animate-bounce">
            🎉
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-bold text-white">
              {t('flashcards.completeTitle')}
            </h3>
            <p className="text-sm text-slate-400 max-w-sm">
              {t('flashcards.completeDescription')}
            </p>
          </div>

          {/* Session Statistics */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-md bg-slate-950/40 p-4 rounded-xl border border-slate-900 my-2">
            <div className="flex flex-col gap-1 items-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase">{t('flashcards.mastered')}</span>
              <span className="text-lg font-extrabold text-emerald-450">{masteredCount}</span>
            </div>
            <div className="flex flex-col gap-1 items-center border-x border-slate-850">
              <span className="text-[10px] text-slate-500 font-bold uppercase">{t('flashcards.reviewing')}</span>
              <span className="text-lg font-extrabold text-indigo-400">{reviewingCount}</span>
            </div>
            <div className="flex flex-col gap-1 items-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase">{t('flashcards.learning')}</span>
              <span className="text-lg font-extrabold text-amber-500">{learningCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <Button onClick={handleRestart} variant="secondary" className="font-bold flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4" />
              <span>{t('flashcards.studyAgain')}</span>
            </Button>
            <Button
              nativeButton={false}
              render={<Link href={`/files/${set.fileId}`} />}
              variant="primary"
              className="font-bold"
            >
              <span>{t('flashcards.backToDocument')}</span>
            </Button>
          </div>
        </Card>
      ) : (
        /* ================= CARDS ACTIVE FLIPPING ================= */
        <div className="flex flex-col gap-8">
          {/* 3D Flip Card Container */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full h-80 relative cursor-pointer group select-none"
            style={{ perspective: '1000px' }}
          >
            <div
              className="w-full h-full absolute transition-transform duration-500 transform-style-3d shadow-xl"
              style={{
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transformStyle: 'preserve-3d',
              }}
            >
              {/* CARD FRONT */}
              <div
                className="w-full h-full absolute rounded-2xl bg-slate-900/40 border border-slate-800/60 p-8 flex flex-col justify-between items-center text-center backdrop-blur-md"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <span className="text-[10px] text-indigo-400 font-extrabold tracking-wider uppercase bg-indigo-500/10 px-3 py-1 rounded-full flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5" />
                  <span>{t('flashcards.questionConcept')}</span>
                </span>
                
                <p className="text-lg md:text-xl font-bold text-white leading-relaxed max-w-lg select-text my-auto">
                  {currentCard.front}
                </p>

                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                  {t('flashcards.flipHint')}
                </span>
              </div>

              {/* CARD BACK */}
              <div
                className="w-full h-full absolute rounded-2xl bg-slate-900/80 border border-slate-800/80 p-8 flex flex-col justify-between items-center text-center backdrop-blur-lg"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <span className="text-[10px] text-emerald-450 font-extrabold tracking-wider uppercase bg-emerald-500/10 px-3 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{t('flashcards.sampleAnswer')}</span>
                </span>

                <p className="text-base md:text-lg text-slate-250 leading-relaxed max-w-lg select-text my-auto overflow-y-auto max-h-[140px] px-2 py-1 scrollbar-thin">
                  {currentCard.back}
                </p>

                <span className="text-xs text-slate-500 font-semibold">
                  {t('flashcards.recallHint')}
                </span>
              </div>
            </div>
          </div>

          {/* Spaced Repetition Mastery Selection Buttons */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-bold text-white text-center">
              {t('flashcards.recallQuestion')}
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <Button
                onClick={() => handleReview('learning')}
                disabled={!isFlipped || submittingReview}
                variant="danger"
                className="py-6 rounded-xl font-bold border-rose-500/10 text-white disabled:opacity-40"
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span>{t('flashcards.hardLearn')}</span>
                  <span className="text-[10px] opacity-75 font-normal">({t('flashcards.oneDay')})</span>
                </div>
              </Button>

              <Button
                onClick={() => handleReview('reviewing')}
                disabled={!isFlipped || submittingReview}
                variant="secondary"
                className="py-6 rounded-xl font-bold border-indigo-500/10 text-white disabled:opacity-40"
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span>{t('flashcards.mediumReview')}</span>
                  <span className="text-[10px] opacity-75 font-normal">({t('flashcards.threeDays')})</span>
                </div>
              </Button>

              <Button
                onClick={() => handleReview('mastered')}
                disabled={!isFlipped || submittingReview}
                variant="secondary"
                className="py-6 rounded-xl font-bold bg-emerald-600/10 hover:bg-emerald-600/20 border-emerald-500/20 text-emerald-450 disabled:opacity-40"
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span>{t('flashcards.easyMastered')}</span>
                  <span className="text-[10px] opacity-75 font-normal">({t('flashcards.sevenDays')})</span>
                </div>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
