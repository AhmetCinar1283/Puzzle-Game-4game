-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 0005_played_levels.sql
-- Description: Canonical store for user level completion records (playedLevels).
--              Migrated from Firestore subcollection users/{uid}/playedLevels/{levelId}.
--
--              Also adds `deleted_levels` for delta-sync tombstone tracking:
--              when a level is deleted by an admin, its ID is recorded here so
--              clients can purge stale Dexie cache entries on next sync.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── played_levels ───────────────────────────────────────────────────────────
-- Primary key: (uid, level_id) — one row per user per level.
-- stars / score are never decremented: UPSERT uses MAX() on conflict.
-- move_count is the user's best (lowest) solution — updated only when improving.

CREATE TABLE IF NOT EXISTS played_levels (
  uid          TEXT    NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
  level_id     TEXT    NOT NULL CHECK (length(level_id) BETWEEN 1 AND 128),
  stars        INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 3),
  score        INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  move_count   INTEGER NOT NULL CHECK (move_count >= 1),
  time_spent   INTEGER NOT NULL DEFAULT 0 CHECK (time_spent >= 0),  -- seconds
  completed_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (uid, level_id)
);

-- Delta sync index: GET /played-levels?since=T -- uid's rows where updated_at > T
CREATE INDEX IF NOT EXISTS idx_played_levels_uid_updated
  ON played_levels(uid, updated_at ASC);

-- Cascade delete index: DELETE /admin/levels/:id -- all rows for a level_id
CREATE INDEX IF NOT EXISTS idx_played_levels_level_id
  ON played_levels(level_id);

-- ─── deleted_levels ──────────────────────────────────────────────────────────
-- Tombstone table: records levels that have been permanently deleted by an admin.
-- Used by GET /played-levels to return `deletedLevelIds` so clients can
-- purge stale Dexie cache entries on their next sync.
-- Rows in this table are kept indefinitely (cheap, one row per deleted level).

CREATE TABLE IF NOT EXISTS deleted_levels (
  level_id   TEXT NOT NULL PRIMARY KEY CHECK (length(level_id) BETWEEN 1 AND 128),
  deleted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
