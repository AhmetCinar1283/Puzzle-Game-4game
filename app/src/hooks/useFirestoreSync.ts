'use client';

import { useEffect, useRef } from 'react';
import { syncPlayedLevels } from '@/app/src/lib/firebase/sync';
import { useAuthContext } from '@/app/src/contexts/AuthContext';

/**
 * Triggers Firestore → Dexie sync for played levels on:
 * 1. First mount (app open)
 * 2. Page visibility change: hidden → visible (tab switch / screen reopen)
 *
 * Level metadata sync is handled by the /levels page itself (syncLevelsMeta).
 */
export function useFirestoreSync() {
  const { user } = useAuthContext();
  const hasSyncedOnMount = useRef(false);

  useEffect(() => {
    if (hasSyncedOnMount.current) return;
    hasSyncedOnMount.current = true;

    const runSync = () => {
      if (user?.uid) {
        syncPlayedLevels(user.uid).catch((err) =>
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
