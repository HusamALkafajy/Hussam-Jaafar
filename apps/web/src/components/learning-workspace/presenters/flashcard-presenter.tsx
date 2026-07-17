import React, { useState } from 'react';
import { PresenterProps } from '../presentation-registry';
import { Button } from '../../ui/button';
import { RotateCcw, ThumbsUp, ThumbsDown, BookOpen } from 'lucide-react';

export const FlashcardPresenter: React.FC<PresenterProps> = ({ asset, onAction }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const content = asset.content as { front: string; back: string };

  const handleDifficulty = (difficulty: 'Easy' | 'Medium' | 'Hard') => {
    onAction?.('mark-difficulty', { assetId: asset.assetId, difficulty });
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl h-full gap-8">
      <div 
        className="w-full aspect-[3/2] bg-card border rounded-2xl shadow-sm p-12 flex items-center justify-center text-center cursor-pointer hover:shadow-md transition-shadow relative"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className="absolute top-4 right-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onAction?.('open-citation', { citation: asset.sourceCitation });
            }}
          >
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
        <p className="text-2xl font-medium">
          {isFlipped ? content.back : content.front}
        </p>
      </div>

      <div className="flex items-center gap-4 w-full">
        {!isFlipped ? (
          <Button className="w-full" size="lg" onClick={() => setIsFlipped(true)}>
            Show Answer
          </Button>
        ) : (
          <div className="flex gap-4 w-full">
            <Button variant="outline" className="flex-1" size="lg" onClick={() => handleDifficulty('Hard')}>
              <ThumbsDown className="w-4 h-4 mr-2" /> Hard
            </Button>
            <Button variant="outline" className="flex-1" size="lg" onClick={() => handleDifficulty('Medium')}>
              <RotateCcw className="w-4 h-4 mr-2" /> Again
            </Button>
            <Button variant="default" className="flex-1" size="lg" onClick={() => handleDifficulty('Easy')}>
              <ThumbsUp className="w-4 h-4 mr-2" /> Easy
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
