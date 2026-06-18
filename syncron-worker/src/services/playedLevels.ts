/**
 * D1 service layer for the `played_levels` and `deleted_levels` tables.
 *
 * All playedLevel writes go through here — no Firestore subcollection involvement.
 */

import type { StarCount } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface D1PlayedLevelRow {
  uid: string;
  level_id: string;
  stars: StarCount;
  score: number;
  move_count: number;
  time_spent: number;
  completed_at: string;
  updated_at: string;
}

export interface UpsertPlayedLevelParams {
  uid: string;
  levelId: string;
  stars: StarCount;
  score: number;
  moveCount: number;
  timeSpent: number;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Fetch a single played_levels row for (uid, levelId).
 * Returns null if the user has not yet completed this level.
 */
export async function getPlayedLevel(
  db: D1Database,
  uid: string,
  levelId: string,
): Promise<D1PlayedLevelRow | null> {
  return db
    .prepare(
      `SELECT uid, level_id, stars, score, move_count, time_spent, completed_at, updated_at
       FROM played_levels
       WHERE uid = ?1 AND level_id = ?2`,
    )
    .bind(uid, levelId)
    .first<D1PlayedLevelRow>();
}

/**
 * Fetch all played_levels rows for a user that were updated after `since`.
 * Pass `since = null` (or omit it) to return all rows (full sync).
 *
 * Returns rows in ascending `updated_at` order so the client can use the
 * last row's `updated_at` as its next `since` cursor if needed.
 */
export async function getPlayedLevelsSince(
  db: D1Database,
  uid: string,
  since: string | null,
): Promise<D1PlayedLevelRow[]> {
  if (since) {
    const result = await db
      .prepare(
        `SELECT uid, level_id, stars, score, move_count, time_spent, completed_at, updated_at
         FROM played_levels
         WHERE uid = ?1 AND updated_at > ?2
         ORDER BY updated_at ASC`,
      )
      .bind(uid, since)
      .all<D1PlayedLevelRow>();
    return result.results;
  } else {
    const result = await db
      .prepare(
        `SELECT uid, level_id, stars, score, move_count, time_spent, completed_at, updated_at
         FROM played_levels
         WHERE uid = ?1
         ORDER BY updated_at ASC`,
      )
      .bind(uid)
      .all<D1PlayedLevelRow>();
    return result.results;
  }
}

/**
 * Return level IDs that were deleted after `since` (tombstone lookup for delta sync).
 * If `since` is null, returns ALL deleted level IDs.
 */
export async function getDeletedLevelsSince(
  db: D1Database,
  since: string | null,
): Promise<string[]> {
  const result = since
    ? await db
        .prepare(`SELECT level_id FROM deleted_levels WHERE deleted_at > ?1`)
        .bind(since)
        .all<{ level_id: string }>()
    : await db
        .prepare(`SELECT level_id FROM deleted_levels`)
        .all<{ level_id: string }>();

  return result.results.map((r) => r.level_id);
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * UPSERT a level completion into played_levels.
 *
 * Returns `wasFirstCompletion: true` when the row was freshly INSERTed (not updated).
 * This is the authoritative source for isFirstCompletion — eliminates the race
 * condition where two concurrent requests both read the row as missing and both
 * try to increment completedCount in Firestore.
 *
 * Rules on conflict (same uid + level_id):
 *   - stars / score: only advance (MAX), never decrease
 *   - move_count: keep the lower value (best solution)
 *   - time_spent: overwrite with latest run
 *   - completed_at: keep the original first-completion timestamp
 *   - updated_at: always set to now
 */
export async function upsertPlayedLevel(
  db: D1Database,
  params: UpsertPlayedLevelParams,
): Promise<{ wasFirstCompletion: boolean }> {
  const now = new Date().toISOString();

  // SQLite trick: the WHERE clause in DO UPDATE means the UPDATE only fires when
  // there is an actual improvement. If neither condition is met, nothing is written
  // (the row already has better or equal data). We track insertion vs update via
  // changes() — 1 on INSERT, 1 on UPDATE, 0 on no-op conflict.
  //
  // To reliably detect INSERT vs UPDATE we use a sentinel: set `completed_at` to
  // the insert value only on INSERT; the ON CONFLICT clause preserves the existing
  // `completed_at`. After the upsert we read `completed_at` back: if it equals
  // `now` then this was the first completion.
  const result = await db
    .prepare(
      `INSERT INTO played_levels
         (uid, level_id, stars, score, move_count, time_spent, completed_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT (uid, level_id) DO UPDATE SET
         stars        = MAX(excluded.stars,      played_levels.stars),
         score        = MAX(excluded.score,      played_levels.score),
         move_count   = MIN(excluded.move_count, played_levels.move_count),
         time_spent   = excluded.time_spent,
         -- Never overwrite the original completed_at timestamp
         completed_at = played_levels.completed_at,
         updated_at   = excluded.updated_at
       WHERE excluded.stars >= played_levels.stars
          OR excluded.move_count < played_levels.move_count
       RETURNING (completed_at = ?7) AS is_new`,
    )
    .bind(
      params.uid,
      params.levelId,
      params.stars,
      params.score,
      params.moveCount,
      params.timeSpent,
      now, // completed_at (= ?7, used in RETURNING check)
      now, // updated_at   (= ?8)
    )
    .first<{ is_new: number }>();

  // RETURNING gives us the row after write. is_new=1 means completed_at was just set
  // (INSERT path). is_new=0 means existing completed_at was preserved (UPDATE path).
  // null means the ON CONFLICT WHERE clause suppressed the update (no change needed).
  const wasFirstCompletion = result?.is_new === 1;
  return { wasFirstCompletion };
}

// ─── Level deletion cascade ────────────────────────────────────────────────────

export interface LevelDeletionImpact {
  /** Map of uid → { stars, isFirstCompletion } for rebuilding leaderboard counters */
  affectedUsers: Array<{
    uid: string;
    stars: number;
  }>;
  /** uid of the player who held the world record (best move_count) for this level, if any */
  worldRecordHolderUid: string | null;
}

/**
 * Reads all played_levels rows for a level before deleting them.
 * Returns the data needed to roll back leaderboard counters.
 */
export async function getLevelDeletionImpact(
  db: D1Database,
  levelId: string,
): Promise<LevelDeletionImpact> {
  const rows = await db
    .prepare(
      `SELECT uid, stars, move_count FROM played_levels WHERE level_id = ?1 ORDER BY move_count ASC`,
    )
    .bind(levelId)
    .all<{ uid: string; stars: number; move_count: number }>();

  const affectedUsers = rows.results.map((r) => ({ uid: r.uid, stars: r.stars }));
  const worldRecordHolderUid = rows.results[0]?.uid ?? null;

  return { affectedUsers, worldRecordHolderUid };
}

/**
 * Delete all played_levels rows for a level and record the tombstone.
 * Call this AFTER rolling back leaderboard counters.
 */
export async function deleteLevelRecords(
  db: D1Database,
  levelId: string,
): Promise<void> {
  await db.batch([
    db
      .prepare(`DELETE FROM played_levels WHERE level_id = ?1`)
      .bind(levelId),
    db
      .prepare(
        `INSERT OR IGNORE INTO deleted_levels (level_id) VALUES (?1)`,
      )
      .bind(levelId),
  ]);
}
