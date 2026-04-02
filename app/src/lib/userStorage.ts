/**
 * User-scoped localStorage utilities.
 *
 * Keys are prefixed with the current user's UID (read from `activeUserId`
 * in localStorage), so data from different accounts never overlaps on the
 * same device.
 *
 * - Plain functions (`userStorageGet` / `userStorageSet` / `userStorageRemove`):
 *   use from lib/ or other non-React code.
 * - `useUserStorage()` hook: use from React components and hooks.
 */

const USER_ID_KEY = 'activeUserId';

function prefix(key: string): string {
  try {
    const uid = localStorage.getItem(USER_ID_KEY) ?? 'anon';
    return `${uid}:${key}`;
  } catch {
    return `anon:${key}`;
  }
}

export function userStorageGet(key: string): string | null {
  try { return localStorage.getItem(prefix(key)); } catch { return null; }
}

export function userStorageSet(key: string, value: string): void {
  try { localStorage.setItem(prefix(key), value); } catch { /* quota */ }
}

export function userStorageRemove(key: string): void {
  try { localStorage.removeItem(prefix(key)); } catch { /* ignore */ }
}

// ─── React hook ───────────────────────────────────────────────────────────────

import { useCallback } from 'react';

export function useUserStorage() {
  const getItem    = useCallback((key: string) => userStorageGet(key), []);
  const setItem    = useCallback((key: string, value: string) => userStorageSet(key, value), []);
  const removeItem = useCallback((key: string) => userStorageRemove(key), []);
  return { getItem, setItem, removeItem };
}
