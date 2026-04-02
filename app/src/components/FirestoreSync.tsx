'use client';

import { useFirestoreSync } from '../hooks/useFirestoreSync';

/**
 * Invisible component that mounts in the root layout and triggers
 * Firestore → Dexie synchronization in the background.
 * Renders nothing — side-effects only.
 */
export default function FirestoreSync() {
  useFirestoreSync();
  return null;
}
