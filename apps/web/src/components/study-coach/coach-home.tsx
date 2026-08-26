'use client';

import React, { useEffect, useState } from 'react';
import { useStudyCoach } from './study-coach-provider';
import { CoachCardRegistry } from './coach-card-registry';
import { TodaysPlanCard } from './cards/todays-plan-card';
import { CurrentGoalCard } from './cards/current-goal-card';
import { RecommendationCard } from './cards/recommendation-card';
import { ProgressOverview } from './cards/progress-overview';
import { ReviewQueueCard } from './cards/review-queue-card';
import { TimelineCard } from './cards/timeline-card';
import { CoachConversation } from './conversation/coach-conversation';

// Register cards
if (typeof window !== 'undefined') {
  CoachCardRegistry.register({
    id: 'card_focus',
    title: 'Focus',
    priority: 100,
    category: 'Focus',
    component: TodaysPlanCard,
    visibilityRule: (insight) => insight.category === 'Focus'
  });
  
  CoachCardRegistry.register({
    id: 'card_goal',
    title: 'Goal',
    priority: 90,
    category: 'Goal',
    component: CurrentGoalCard,
    visibilityRule: (insight) => insight.category === 'Goal'
  });

  CoachCardRegistry.register({
    id: 'card_rec',
    title: 'Recommendation',
    priority: 80,
    category: 'Recommendation',
    component: RecommendationCard,
    visibilityRule: (insight) => insight.category === 'Recommendation'
  });

  CoachCardRegistry.register({
    id: 'card_review',
    title: 'Review',
    priority: 70,
    category: 'Review',
    component: ReviewQueueCard,
    visibilityRule: (insight) => insight.category === 'Review'
  });

  CoachCardRegistry.register({
    id: 'card_prog',
    title: 'Progress',
    priority: 60,
    category: 'Progress',
    component: ProgressOverview,
    visibilityRule: (insight) => insight.category === 'Progress'
  });

  CoachCardRegistry.register({
    id: 'card_timeline',
    title: 'Timeline',
    priority: 50,
    category: 'Timeline',
    component: TimelineCard,
    visibilityRule: (insight) => insight.category === 'Timeline'
  });
}

export const CoachHome: React.FC = () => {
  const { domain } = useStudyCoach();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const visibleCards = CoachCardRegistry.getVisibleCards(domain.insights);

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto">
      {/* Left Column: Insight Cards */}
      <div className="flex-1 flex flex-col gap-6">
        {visibleCards.map(({ card, insight }, index) => {
          const CardComponent = card.component;
          return <CardComponent key={`${card.id}-${insight.id}-${index}`} insight={insight} />;
        })}
      </div>

      {/* Right Column: Conversation */}
      <div className="w-full lg:w-[400px] shrink-0">
        <CoachConversation />
      </div>
    </div>
  );
};
