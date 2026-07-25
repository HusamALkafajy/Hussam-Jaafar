import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api-client';
import { Recommendation } from '@studyai/domain';

export function useRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<Recommendation[]>('/recommendations');
      setRecommendations(data || []);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    isLoading,
    error,
    refresh: fetchRecommendations
  };
}
