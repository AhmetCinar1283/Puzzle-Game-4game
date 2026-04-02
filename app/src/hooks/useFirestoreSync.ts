'use client';

import { useEffect, useRef } from 'react';
import { syncAllParts, syncPlayedLevels } from '@/app/src/lib/firebase/sync';
import { useAuthContext } from '@/app/src/contexts/AuthContext';

/**
 * Triggers Firestore → Dexie sync on:
 * 1. First mount (app open)
 * 2. Page visibility change: hidden → visible (tab switch / screen reopen)
 *
 * The sync function itself enforces a cooldown — calling it too often is safe.
 */
export function useFirestoreSync() {
  const { user } = useAuthContext();
  const hasSyncedOnMount = useRef(false);

  useEffect(() => {
    if (hasSyncedOnMount.current) return;
    hasSyncedOnMount.current = true;

    const runSync = () => {
      syncAllParts().catch((err) =>
        console.warn('[Sync] Parts sync failed:', err),
      );
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
