import React from 'react';
import { useRecommendations } from '../../../hooks/use-recommendations';
import { Section } from '../../../components/ui/section';
import { Grid } from '../../../components/ui/grid';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { ContinueLearningWidget } from './continue-learning-widget';
import { FlashcardReviewWidget } from './flashcard-review-widget';
import { SuggestedQuizWidget } from './suggested-quiz-widget';
import { TutorRecommendationWidget } from './tutor-recommendation-widget';

export function RecommendationsPanel() {
  const { recommendations, isLoading, error } = useRecommendations();

  if (isLoading) {
    return (
      <Section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Recommended for You
          </h3>
        </div>
        <div className="flex items-center justify-center p-12 bg-muted/20 rounded-xl border border-dashed border-border">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section>
        <div className="flex items-center justify-center p-8 bg-destructive/5 rounded-xl border border-destructive/20 text-destructive">
          <AlertCircle className="w-6 h-6 mr-3" />
          <span>Failed to load recommendations. Please try again later.</span>
        </div>
      </Section>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    // Empty state gracefully hides if no recommendations exist per requirements.
    // However, if we must show encouraging guidance, we can show a placeholder.
    return (
      <Section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Recommended for You
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center p-12 bg-muted/10 rounded-xl border border-dashed border-border text-center">
          <Sparkles className="w-10 h-10 text-muted-foreground mb-4" />
          <h4 className="text-lg font-semibold text-foreground">You're all caught up!</h4>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Upload a new document, start a quiz, or review your notes to get personalized study suggestions.
          </p>
        </div>
      </Section>
    );
  }

  // Sort by priority logic is handled by the backend pipeline, so we just render them
  return (
    <Section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Recommended for You
        </h3>
      </div>
      <Grid cols={1} gap={4}>
        {recommendations.map(rec => {
          switch (rec.type) {
            case 'ContinueSession':
            case 'ContinueLearning':
            case 'RecentlyInterrupted':
              return <ContinueLearningWidget key={rec.id} recommendation={rec} />;
            case 'ReviewFlashcards':
              return <FlashcardReviewWidget key={rec.id} recommendation={rec} />;
            case 'RetryQuiz':
            case 'ReviewWeakConcepts':
              return <SuggestedQuizWidget key={rec.id} recommendation={rec} />;
            case 'AskTutor':
              return <TutorRecommendationWidget key={rec.id} recommendation={rec} />;
            default:
              return null;
          }
        })}
      </Grid>
    </Section>
  );
}
