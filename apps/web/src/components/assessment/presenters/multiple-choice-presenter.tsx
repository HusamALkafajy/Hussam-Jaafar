import React from 'react';
import { QuestionPresenterProps } from '../question-presenter-registry';
import { Button } from '../../ui/button';

export const MultipleChoicePresenter: React.FC<QuestionPresenterProps> = ({ asset, currentValue, onAnswer, disabled }) => {
  const { question, options } = asset.content || {};

  if (!question || !Array.isArray(options)) {
    return <div className="p-4 text-red-500">Invalid multiple choice asset</div>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-medium">{question}</h3>
      <div className="grid grid-cols-1 gap-3">
        {options.map((opt: string, index: number) => (
          <Button
            key={index}
            variant={currentValue === opt ? 'default' : 'outline'}
            className="justify-start h-auto p-4 text-left whitespace-normal"
            onClick={() => onAnswer(opt)}
            disabled={disabled}
          >
            {opt}
          </Button>
        ))}
      </div>
    </div>
  );
};
