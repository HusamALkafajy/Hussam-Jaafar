export type RecommendationEventAction = 
  | 'displayed' 
  | 'clicked' 
  | 'accepted' 
  | 'dismissed' 
  | 'completed' 
  | 'ignored' 
  | 'expired';

export interface RecommendationAnalyticsEvent {
  /** The optional ID of the recommendation if it was persisted */
  recommendationId?: string;
  /** The identifier of the rule that generated this recommendation */
  ruleIdentifier: string;
  /** The type of recommendation (e.g., ReviewFlashcards) */
  recommendationType: string;
  /** The lifecycle action occurring on the recommendation */
  action: RecommendationEventAction;
  /** The user ID taking the action */
  userId: string;
  /** Optional contextual metadata (e.g., current route, priority level) */
  context?: Record<string, any>;
  /** Timestamp of the event */
  createdAt?: Date;
}

export interface RuleEffectivenessMetrics {
  ruleIdentifier: string;
  displayCount: number;
  clickCount: number;
  completionCount: number;
  
  /** (clickCount / displayCount) * 100 */
  clickThroughRate: number;
  /** (completionCount / displayCount) * 100 */
  completionRate: number;
  
  /** 
   * Calculated heuristic score to evaluate overall effectiveness
   * E.g., (CTR * 0.4) + (CompletionRate * 0.6)
   */
  effectivenessScore: number;
}
