'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { FlashcardReviewer } from '@/components/flashcards/flashcard-reviewer';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function FlashcardsPage(props: PageProps) {
  const router = useRouter();
  const params = use(props.params);
  const fileId = params.id;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [setId, setSetId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCards() {
      try {
        const response = await fetch(`/api/flashcard-sets?fileId=${fileId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Flashcards not found. Please wait for the document to finish processing or try re-analyzing.');
          } else {
            setError('Failed to load flashcards.');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        if (data && data.cards) {
          setSetId(data.id);
          setCards(data.cards.map((c: any) => ({
            id: c.id,
            front: c.front,
            back: c.back,
            masteryLevel: c.masteryLevel
          })));
        }
        setLoading(false);
      } catch (err) {
        setError('An unexpected error occurred.');
        setLoading(false);
      }
    }

    fetchCards();
  }, [fileId]);

  const handleReview = async (cardId: string, quality: number) => {
    try {
      await fetch(`/api/flashcards/${cardId}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quality }),
      });
    } catch (err) {
      console.error('Failed to submit review', err);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading flashcards...</div>;
  
  if (error) return (
    <div className="p-8 text-center text-red-600">
      <p>{error}</p>
      <button 
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={() => router.push(`/files/${fileId}`)}
      >
        Back to Document
      </button>
    </div>
  );

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8 text-center">Study Flashcards</h1>
      <FlashcardReviewer 
        cards={cards} 
        onReview={handleReview} 
        onComplete={() => router.push(`/files/${fileId}`)} 
      />
    </div>
  );
}
