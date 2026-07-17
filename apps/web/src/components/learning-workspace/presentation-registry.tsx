import React from 'react';
import { ArtifactType } from '@studyai/domain/learning-artifact';
import { LearningAsset } from '@studyai/domain/learning-asset';
import { FlashcardPresenter } from './presenters/flashcard-presenter';
import { QuizPresenter } from './presenters/quiz-presenter';
import { RevisionPresenter } from './presenters/revision-presenter';
import { SummaryPresenter } from './presenters/summary-presenter';

export type PresenterProps = {
  asset: LearningAsset;
  onAction?: (action: string, payload?: any) => void;
};

export class PresentationRegistry {
  private presenters = new Map<ArtifactType, React.FC<PresenterProps>>();

  register(type: ArtifactType, component: React.FC<PresenterProps>) {
    this.presenters.set(type, component);
  }

  getPresenter(type: ArtifactType): React.FC<PresenterProps> {
    const Component = this.presenters.get(type);
    if (!Component) {
      return ({ asset }) => (
        <div className="p-4 border rounded-lg bg-muted text-muted-foreground">
          Presenter not found for asset type: {asset.assetType}
        </div>
      );
    }
    return Component;
  }
}

export const presentationRegistry = new PresentationRegistry();

presentationRegistry.register('Flashcard', FlashcardPresenter);
presentationRegistry.register('QuizQuestion', QuizPresenter);
presentationRegistry.register('RevisionPlan', RevisionPresenter);
presentationRegistry.register('Summary', SummaryPresenter);
