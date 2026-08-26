import { Injectable, Logger } from '@nestjs/common';
import { AdaptiveGoal, Recommendation, LearnerProfile } from '@studyai/domain';

export interface PlannedPathNode {
  recommendation: Recommendation;
  assignedGoalId?: string;
  explanation: string;
}

@Injectable()
export class LearningPathPlannerService {
  private readonly logger = new Logger(LearningPathPlannerService.name);

  /**
   * Consumes standard recommendations and orders/filters them deterministically
   * to align with the learner's adaptive goals.
   */
  planPath(profile: LearnerProfile, goals: AdaptiveGoal[], rawRecommendations: Recommendation[]): PlannedPathNode[] {
    this.logger.debug(`Planning learning path for user ${profile.userId}`);

    if (rawRecommendations.length === 0) {
      return [];
    }

    const path: PlannedPathNode[] = [];
    const usedRecIds = new Set<string>();

    // 1. Try to fulfill Critical/High priority goals first
    for (const goal of goals) {
      if (goal.priority === 'Critical' || goal.priority === 'High') {
        const matchingRec = this.findBestMatchForGoal(goal, rawRecommendations, usedRecIds);
        if (matchingRec) {
          path.push({
            recommendation: matchingRec,
            assignedGoalId: goal.id,
            explanation: `Recommended with high priority to address your goal: ${goal.objective}. ${goal.evidence}`,
          });
          usedRecIds.add(matchingRec.id);
        }
      }
    }

    // 2. Add remaining recommendations, sorted by score, up to a limit
    const remaining = rawRecommendations
      .filter(r => !usedRecIds.has(r.id))
      .sort((a, b) => b.confidence - a.confidence);

    for (const rec of remaining) {
      if (path.length >= 5) break; // Limit path to top 5 immediate tasks

      // Check if it matches a lower priority goal
      const matchingGoal = goals.find(g => this.doesRecommendationHelpGoal(rec, g));
      
      path.push({
        recommendation: rec,
        assignedGoalId: matchingGoal?.id,
        explanation: matchingGoal 
          ? `Recommended to help with: ${matchingGoal.objective}.` 
          : 'Recommended based on your standard learning trajectory.',
      });
      usedRecIds.add(rec.id);
    }

    return path;
  }

  private findBestMatchForGoal(goal: AdaptiveGoal, recs: Recommendation[], excludeIds: Set<string>): Recommendation | undefined {
    // Basic heuristic: if the goal targets a specific concept, find a recommendation for that concept
    if (goal.targetConceptId) {
      const match = recs.find(r => 
        !excludeIds.has(r.id) && 
        r.targetResourceId === goal.targetConceptId
      );
      if (match) return match;
    }

    // If it's a general retention goal, find a flashcard review
    if (goal.goalType === 'ImproveRetention') {
      const match = recs.find(r => 
        !excludeIds.has(r.id) && 
        r.type === 'ReviewFlashcards'
      );
      if (match) return match;
    }

    return undefined;
  }

  private doesRecommendationHelpGoal(rec: Recommendation, goal: AdaptiveGoal): boolean {
    if (goal.targetConceptId && rec.targetResourceId === goal.targetConceptId) return true;
    if (goal.goalType === 'ImproveRetention' && rec.type === 'ReviewFlashcards') return true;
    return false;
  }
}
