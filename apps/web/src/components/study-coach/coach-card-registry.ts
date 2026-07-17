import React from 'react';
import { LucideIcon } from 'lucide-react';
import { InsightModel } from './insight-builder';

export interface CoachCardProps {
  insight: InsightModel;
  onAction?: (actionId: string, payload?: any) => void;
}

export interface CoachCardRegistration {
  id: string;
  title: string;
  priority: number;
  category: string;
  icon?: LucideIcon;
  component: React.FC<CoachCardProps>;
  visibilityRule: (insight: InsightModel) => boolean;
}

class CardRegistry {
  private cards: Map<string, CoachCardRegistration> = new Map();

  register(registration: CoachCardRegistration) {
    this.cards.set(registration.id, registration);
  }

  getVisibleCards(insights: InsightModel[]): { card: CoachCardRegistration, insight: InsightModel }[] {
    const results: { card: CoachCardRegistration, insight: InsightModel }[] = [];
    
    insights.forEach(insight => {
      // Find cards that can render this insight type/category
      const validCards = Array.from(this.cards.values()).filter(c => c.visibilityRule(insight));
      validCards.forEach(c => results.push({ card: c, insight }));
    });

    return results.sort((a, b) => b.card.priority - a.card.priority);
  }
}

export const CoachCardRegistry = new CardRegistry();
