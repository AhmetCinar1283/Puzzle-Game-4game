'use client';

import { useEffect, useRef } from 'react';
import { syncPlayedLevelsFromWorker } from '@/app/src/lib/sync/playedLevels';
import { useAuthContext } from '@/app/src/contexts/AuthContext';

/**
 * Triggers Cloudflare D1 → Dexie sync for played levels on:
 * 1. First mount (app open)
 * 2. Page visibility change: hidden → visible (tab switch / screen reopen)
 *
 * Level metadata sync is handled by the /levels page itself (syncLevelsMeta).
 * The 5-minute cooldown inside syncPlayedLevelsFromWorker prevents redundant calls.
 */
export function useFirestoreSync() {
  const { user } = useAuthContext();
  const hasSyncedOnMount = useRef(false);

  useEffect(() => {
    if (hasSyncedOnMount.current) return;
    hasSyncedOnMount.current = true;

    const runSync = () => {
      if (user) {
        syncPlayedLevelsFromWorker(user).catch((err) =>
          console.warn('[Sync] PlayedLevels sync failed:', err),
        );
      }
    };

    runSync();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);
}
