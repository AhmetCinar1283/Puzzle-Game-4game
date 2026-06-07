import { useState, useEffect, useCallback } from 'react';
import { getUserBadges, updateShowcase, Badge } from '../lib/api/badgesClient';

const cache: Record<string, { data: Badge[]; timestamp: number }> = {};
const CACHE_DURATION_MS = 60000; // 1 minute

export function useBadges(uid: string | null) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchBadges = useCallback(async (force = false) => {
    if (!uid) {
      setBadges([]);
      return;
    }

    const now = Date.now();
    const cached = cache[uid];
    if (!force && cached && now - cached.timestamp < CACHE_DURATION_MS) {
      setBadges(cached.data);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getUserBadges(uid);
      if (res.success) {
        setBadges(res.badges);
        cache[uid] = { data: res.badges, timestamp: now };
      } else {
        throw new Error('Failed to load badges');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching badges');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  const saveShowcase = useCallback(async (badgeIds: string[]) => {
    setSaving(true);
    setError(null);
    try {
      const res = await updateShowcase(badgeIds);
      if (res.success) {
        // Invalidate cache
        if (uid) {
          delete cache[uid];
        }
        await fetchBadges(true);
        return true;
      } else {
        throw new Error('Failed to update showcase');
      }
    } catch (err: any) {
      setError(err.message || 'Error saving showcase');
      return false;
    } finally {
      setSaving(false);
    }
  }, [uid, fetchBadges]);

  return {
    badges,
    loading,
    error,
    saving,
    refresh: () => fetchBadges(true),
    saveShowcase,
  };
}
