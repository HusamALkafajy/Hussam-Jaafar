'use client';

import { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  masteryLevel: string;
}

interface FlashcardReviewerProps {
  cards: Flashcard[];
  onReview: (cardId: string, quality: number) => Promise<void>;
  onComplete: () => void;
}

export function FlashcardReviewer({ cards, onReview, onComplete }: FlashcardReviewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (cards.length === 0) {
    return <div className="text-center p-8">No flashcards available.</div>;
  }

  if (currentIndex >= cards.length) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8">
        <h2 className="text-2xl font-bold text-green-600">Session Complete!</h2>
        <p className="text-gray-600">Great job reviewing {cards.length} cards.</p>
        <Button onClick={onComplete}>Back to Document</Button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  const handleScore = async (quality: number) => {
    await onReview(currentCard.id, quality);
    setFlipped(false);
    setCurrentIndex(currentIndex + 1);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto p-4 space-y-8">
      <div className="text-sm text-gray-500">
        Card {currentIndex + 1} of {cards.length}
      </div>

      <div 
        className="relative w-full h-80 perspective-1000 cursor-pointer"
        onClick={() => setFlipped(!flipped)}
      >
        <Card className={`absolute w-full h-full flex items-center justify-center p-8 text-center text-xl transition-all duration-500 backface-hidden ${flipped ? 'rotate-y-180 opacity-0' : 'opacity-100 shadow-lg'}`}>
          {currentCard.front}
        </Card>
        
        <Card className={`absolute w-full h-full flex flex-col items-center justify-center p-8 text-center transition-all duration-500 backface-hidden bg-primary/5 border-primary/20 ${flipped ? 'opacity-100 rotate-y-0 shadow-lg' : '-rotate-y-180 opacity-0'}`}>
          <div className="text-sm text-gray-500 mb-4 font-semibold uppercase tracking-wider">Answer</div>
          <div className="text-xl">{currentCard.back}</div>
        </Card>
      </div>

      <div className="h-20 w-full flex justify-center">
        {!flipped ? (
          <Button size="lg" className="w-48" onClick={() => setFlipped(true)}>
            Show Answer
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-2 w-full">
            <Button variant="outline" className="border-red-200 hover:bg-red-50 text-red-700" onClick={(e) => { e.stopPropagation(); handleScore(1); }}>
              <div className="flex flex-col items-center"><span>1</span><span className="text-xs">Again</span></div>
            </Button>
            <Button variant="outline" className="border-orange-200 hover:bg-orange-50 text-orange-700" onClick={(e) => { e.stopPropagation(); handleScore(2); }}>
              <div className="flex flex-col items-center"><span>2</span><span className="text-xs">Hard</span></div>
            </Button>
            <Button variant="outline" className="border-blue-200 hover:bg-blue-50 text-blue-700" onClick={(e) => { e.stopPropagation(); handleScore(4); }}>
              <div className="flex flex-col items-center"><span>4</span><span className="text-xs">Good</span></div>
            </Button>
            <Button variant="outline" className="border-green-200 hover:bg-green-50 text-green-700" onClick={(e) => { e.stopPropagation(); handleScore(5); }}>
              <div className="flex flex-col items-center"><span>5</span><span className="text-xs">Easy</span></div>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
