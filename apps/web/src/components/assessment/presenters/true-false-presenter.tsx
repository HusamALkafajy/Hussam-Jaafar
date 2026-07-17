import React from 'react';
import { QuestionPresenterProps } from '../question-presenter-registry';
import { Button } from '../../ui/button';

export const TrueFalsePresenter: React.FC<QuestionPresenterProps> = ({ asset, currentValue, onAnswer, disabled }) => {
  const { question } = asset.content || {};

  if (!question) {
    return <div className="p-4 text-red-500">Invalid true/false asset</div>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-medium">{question}</h3>
      <div className="grid grid-cols-2 gap-4">
        <Button
          variant={currentValue === true ? 'default' : 'outline'}
          className="h-16 text-lg"
          onClick={() => onAnswer(true)}
          disabled={disabled}
        >
          True
        </Button>
        <Button
          variant={currentValue === false ? 'default' : 'outline'}
          className="h-16 text-lg"
          onClick={() => onAnswer(false)}
          disabled={disabled}
        >
          False
        </Button>
      </div>
    </div>
  );
};
