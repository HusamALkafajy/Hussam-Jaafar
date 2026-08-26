import React, { useState } from 'react';
import { useRevision } from '../revision-provider';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../ui/card';
import { Button } from '../../ui/button';

export const RevisionCard: React.FC = () => {
  const { session, reviewCurrent, skipCurrent, isSessionActive } = useRevision();
  const [showAnswer, setShowAnswer] = useState(false);

  if (!isSessionActive || !session || !session.currentItem) return null;

  const item = session.currentItem;

  const handleRate = (performance: 'Again' | 'Hard' | 'Good' | 'Easy') => {
    reviewCurrent(performance);
    setShowAnswer(false);
  };

  const handleSkip = () => {
    skipCurrent();
    setShowAnswer(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto min-h-[400px] flex flex-col mt-8 shadow-md">
      <CardHeader>
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>Asset ID: {item.assetId}</span>
          <span>State: {item.memoryState}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center items-center text-center p-8">
        <h3 className="text-2xl font-medium mb-8">Review Content for {item.assetId}</h3>
        
        {showAnswer ? (
          <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-lg w-full mt-4 animate-in fade-in slide-in-from-bottom-4">
            <p className="text-lg text-slate-700 dark:text-slate-300">
              [Answer content would be injected from AssetRegistry here]
            </p>
          </div>
        ) : (
          <Button size="lg" onClick={() => setShowAnswer(true)} className="mt-8">
            Show Answer
          </Button>
        )}
      </CardContent>
      {showAnswer && (
        <CardFooter className="flex flex-col gap-4 border-t pt-6 bg-slate-50 dark:bg-slate-950 rounded-b-xl">
          <p className="text-sm font-medium text-center w-full text-muted-foreground mb-2">How difficult was this?</p>
          <div className="flex gap-2 w-full justify-center">
            <Button variant="outline" className="flex-1 border-red-200 hover:bg-red-50 text-red-700 dark:border-red-900 dark:hover:bg-red-900/50 dark:text-red-400" onClick={() => handleRate('Again')}>Again</Button>
            <Button variant="outline" className="flex-1 border-orange-200 hover:bg-orange-50 text-orange-700 dark:border-orange-900 dark:hover:bg-orange-900/50 dark:text-orange-400" onClick={() => handleRate('Hard')}>Hard</Button>
            <Button variant="outline" className="flex-1 border-green-200 hover:bg-green-50 text-green-700 dark:border-green-900 dark:hover:bg-green-900/50 dark:text-green-400" onClick={() => handleRate('Good')}>Good</Button>
            <Button variant="outline" className="flex-1 border-blue-200 hover:bg-blue-50 text-blue-700 dark:border-blue-900 dark:hover:bg-blue-900/50 dark:text-blue-400" onClick={() => handleRate('Easy')}>Easy</Button>
          </div>
          <Button variant="ghost" className="w-full mt-2" onClick={handleSkip}>
            Skip for now
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
