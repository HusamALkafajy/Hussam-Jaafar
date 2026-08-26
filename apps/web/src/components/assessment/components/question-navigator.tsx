import React from 'react';
import { useAssessment } from '../assessment-provider';
import { Button } from '../../ui/button';

export const QuestionNavigator: React.FC = () => {
  const { session, isFinished, previousQuestion, nextQuestion } = useAssessment();
  
  if (isFinished) return null;

  const { currentQuestion, totalQuestions } = session.progress;

  return (
    <div className="flex items-center justify-between mt-8 pt-4 border-t">
      <Button 
        variant="outline" 
        onClick={previousQuestion}
        disabled={currentQuestion === 1}
      >
        Previous
      </Button>
      
      <span className="text-sm font-medium">
        Question {currentQuestion} of {totalQuestions}
      </span>
      
      <Button 
        variant="outline" 
        onClick={nextQuestion}
        disabled={currentQuestion === totalQuestions}
      >
        Next
      </Button>
    </div>
  );
};
