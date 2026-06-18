/**
 * Client-side sync: fetches played level records from the Cloudflare D1 Worker
 * and merges them into the local Dexie cache.
 *
 * Strategy: delta sync using `?since=` cursor stored in Dexie syncMeta.
 *   - First call (no cursor): fetches ALL records for the user.
 *   - Subsequent calls: fetches only records with updated_at > lastSync.
 *   - Deleted level tombstones are applied to Dexie on every sync.
 *
 * The `serverTime` returned by the Worker (not the client clock) is saved as
 * the next cursor to avoid clock-skew issues.
 */

import type { User } from 'firebase/auth';
import { getDB } from '../db';
import type { StoredPlayedLevel } from '../db';

// ─── Constants ────────────────────────────────────────────────────────────────

const SYNC_KEY = 'playedLevels_d1';
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ?? 'https://syncron-worker.ahmetemre.workers.dev';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readLastSync(): Promise<{ timestamp: number; cursor: string | null }> {
  try {
    const db = getDB();
    const record = await db.syncMeta.get(SYNC_KEY);
    if (!record || record.lastSync === 0) return { timestamp: 0, cursor: null };
    // Reconstruct the ISO cursor from the stored ms timestamp.
    // The Worker stores serverTime as an ISO string; we round-trip via Date.
    return {
      timestamp: record.lastSync,
      cursor: new Date(record.lastSync).toISOString(),
    };
  } catch {
    return { timestamp: 0, cursor: null };
  }
}

async function writeLastSync(serverTimeIso: string): Promise<void> {
  try {
    const db = getDB();
    const tsMs = new Date(serverTimeIso).getTime();
    if (isNaN(tsMs)) return;
    await db.syncMeta.put({ collection: SYNC_KEY, lastSync: tsMs });
  } catch { /* ignore write failures */ }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface SyncPlayedLevelsResult {
  /** Number of records upserted into Dexie */
  upserted: number;
  /** Number of Dexie records deleted (level tombstones) */
  deleted: number;
}

/**
 * Syncs the current user's played level records from Cloudflare D1 → Dexie.
 *
 * @param user   — Firebase Auth user (needed for ID token)
 * @param force  — if true, bypasses the 5-minute cooldown and triggers full sync
 */
export async function syncPlayedLevelsFromWorker(
  user: User,
  force = false,
): Promise<SyncPlayedLevelsResult> {
  const { timestamp: lastSyncMs, cursor: lastCursor } = await readLastSync();

  if (!force && Date.now() - lastSyncMs < SYNC_COOLDOWN_MS) {
    return { upserted: 0, deleted: 0 };
  }

  // Build request URL — omit `since` on first (full) sync
  let url = `${WORKER_URL}/played-levels`;
  if (!force && lastCursor) {
    url += `?since=${encodeURIComponent(lastCursor)}`;
  }

  let token: string;
  try {
    token = await user.getIdToken();
  } catch {
    return { upserted: 0, deleted: 0 };
  }

  let data: {
    success: boolean;
    records: Array<{
      levelId: string;
      stars: 1 | 2 | 3;
      score: number;
      moveCount: number;
      timeSpent: number;
      completedAt: string;
      updatedAt: string;
    }>;
    deletedLevelIds: string[];
    serverTime: string;
  };

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.warn('[PlayedSync] Worker responded', res.status);
      return { upserted: 0, deleted: 0 };
    }
    data = await res.json();
    if (!data.success) return { upserted: 0, deleted: 0 };
  } catch (e) {
    console.warn('[PlayedSync] Fetch error:', e);
    return { upserted: 0, deleted: 0 };
  }

  const dexie = getDB();
  let upserted = 0;
  let deleted = 0;

  // ── Apply records (upsert: server wins on equal or better stars) ─────────
  if (data.records.length > 0) {
    await dexie.transaction('rw', dexie.playedLevels, async () => {
      for (const r of data.records) {
        const existing = await dexie.playedLevels.get(r.levelId);
        // Server is the authority — always write if server stars >= local stars
        // (or if no local record exists).
        if (!existing || r.stars >= (existing.stars ?? 0)) {
          const record: StoredPlayedLevel = {
            levelId:     r.levelId,
            score:       r.score,
            timeSpent:   r.timeSpent,
            completedAt: new Date(r.completedAt).getTime(),
            updatedAt:   new Date(r.updatedAt).getTime(),
            stars:       r.stars,
            moveCount:   r.moveCount,
          };
          await dexie.playedLevels.put(record);
          upserted++;
        }
      }
    });
  }

  // ── Apply tombstones (delete stale Dexie entries for removed levels) ─────
  if (data.deletedLevelIds.length > 0) {
    await dexie.transaction('rw', dexie.playedLevels, async () => {
      for (const levelId of data.deletedLevelIds) {
        const existed = await dexie.playedLevels.get(levelId);
        if (existed) {
          await dexie.playedLevels.delete(levelId);
          deleted++;
        }
      }
    });
  }

  // ── Persist the server-issued cursor ─────────────────────────────────────
  await writeLastSync(data.serverTime);

  if (upserted > 0 || deleted > 0) {
    console.log(`[PlayedSync] upserted=${upserted} deleted=${deleted}`);
  }

  return { upserted, deleted };
}
