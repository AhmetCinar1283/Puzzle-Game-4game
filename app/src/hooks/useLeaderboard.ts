import { useState, useEffect, useCallback } from 'react';
import { getLeaderboard, LeaderboardResponse } from '../lib/api/leaderboardClient';
import { useAuthContext } from '../contexts/AuthContext';

// Simple in-memory cache
const cache: Record<string, { data: LeaderboardResponse; timestamp: number }> = {};
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export function useLeaderboard(
  category: 'stars' | 'levels' | 'records' | 'creators',
  period: 'daily' | 'weekly' | 'monthly' | 'all_time',
  options: {
    aroundMe?: boolean;
    friendsOnly?: boolean;
  } = {}
) {
  const { aroundMe = false, friendsOnly = false } = options;
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthContext();

  const cacheKey = `${category}:${period}:${aroundMe}:${friendsOnly}:${user?.uid || 'anonymous'}`;

  const fetchData = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    const now = Date.now();
    if (!force && cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_DURATION) {
      setData(cache[cacheKey].data);
      setLoading(false);
      return;
    }

    try {
      const response = await getLeaderboard(category, period, {
        limit: 50,
        aroundMe,
        friendsOnly,
      });

      if (response.success) {
        cache[cacheKey] = { data: response, timestamp: now };
        setData(response);
      } else {
        setError('Failed to fetch leaderboard data.');
      }
    } catch (err: any) {
      console.error('[useLeaderboard] Error fetching data:', err);
      setError(err.message || 'An error occurred while fetching leaderboard data.');
    } finally {
      setLoading(false);
    }
  }, [category, period, aroundMe, friendsOnly, cacheKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh: () => fetchData(true),
  };
}
export default useLeaderboard;
