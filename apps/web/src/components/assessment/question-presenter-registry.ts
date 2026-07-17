import React from 'react';
import { LearningAsset } from '@studyai/domain/learning-asset';

export interface QuestionPresenterProps {
  asset: LearningAsset;
  currentValue?: any;
  onAnswer: (value: any) => void;
  disabled?: boolean;
}

export interface QuestionPresenterRegistration {
  assetType: string;
  component: React.FC<QuestionPresenterProps>;
}

class PresenterRegistry {
  private presenters = new Map<string, React.FC<QuestionPresenterProps>>();

  register(registration: QuestionPresenterRegistration) {
    this.presenters.set(registration.assetType, registration.component);
  }

  getPresenter(assetType: string): React.FC<QuestionPresenterProps> | undefined {
    return this.presenters.get(assetType);
  }
}

export const QuestionPresenterRegistry = new PresenterRegistry();
