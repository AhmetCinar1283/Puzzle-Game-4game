-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 0002_leaderboard.sql
-- Description: Leaderboard, badge, and friend system schema.
--              Adds 6 tables that form the foundation for Phases 1–9.
-- Depends on: 0001_initial.sql
--
-- Security hardening (vs. initial draft):
--   • All TEXT fields have explicit length CHECK constraints to prevent
--     disk exhaustion / DoS via oversized payloads.
--   • Empty-string UIDs are rejected (length >= 1).
--   • period_id format is validated against period_type via cross-column
--     CHECK using SQLite GLOB patterns (prevents data-poisoning bugs).
--   • records_count >= 0 prevents negative counters from decrement bugs.
--   • badge rank is bounded to BETWEEN 1 AND 10.
--   • tag minimum length = 2 (single-char tags are meaningless).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. user_profiles ────────────────────────────────────────────────────────
-- Denormalized cache of Firestore user data (displayName, tag).
-- Populated on every `complete-level` call (Phase 2/3).
-- Allows leaderboard JOINs without hitting Firestore on every query.
--
-- Security notes:
--   • uid:          1–128 chars. Firebase UIDs are 28 chars; 128 is a safe upper bound.
--   • display_name: 1–100 chars. Matches game UI character limit.
--   • tag:          NULL (not yet set) OR 2–20 chars. UNIQUE enforced by DB.
--                   Multi-NULL is allowed by SQLite UNIQUE — correct behaviour.

CREATE TABLE IF NOT EXISTS user_profiles (
  uid          TEXT NOT NULL PRIMARY KEY
                    CHECK (length(uid) BETWEEN 1 AND 128),
  display_name TEXT NOT NULL
                    CHECK (length(display_name) BETWEEN 1 AND 100),
  tag          TEXT UNIQUE
                    CHECK (tag IS NULL OR length(tag) BETWEEN 2 AND 20),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Supports GET /users/search?tag=XYZ (Phase 9)
CREATE INDEX IF NOT EXISTS idx_profiles_tag
  ON user_profiles(tag);

-- ─── 2. user_period_scores ───────────────────────────────────────────────────
-- Tracks stars earned and levels completed per user per time period.
-- period_type : 'daily' | 'weekly' | 'monthly' | 'all_time'
-- period_id   : '2026-06-07' | '2026-W23' | '2026-06' | 'all_time'
-- Rows are UPSERTed on every level completion (Phase 2).
--
-- Security notes:
--   • period_type is constrained to the 4 known enum values.
--   • The cross-column CHECK (period_type ↔ period_id) enforces correct formats,
--     preventing data-poisoning caused by timezone bugs or misconfigured servers.
--     GLOB patterns only accept the exact expected formats.
--   • stars_gained and levels_done can never go negative.
--   • uid and period_id have explicit length bounds.

CREATE TABLE IF NOT EXISTS user_period_scores (
  uid          TEXT    NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
  period_type  TEXT    NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
  period_id    TEXT    NOT NULL CHECK (length(period_id) BETWEEN 1 AND 20),
  stars_gained INTEGER NOT NULL DEFAULT 0 CHECK (stars_gained >= 0),
  levels_done  INTEGER NOT NULL DEFAULT 0 CHECK (levels_done >= 0),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (uid, period_type, period_id),
  -- Cross-column: period_id format must match period_type
  -- daily   → 'YYYY-MM-DD'  e.g. '2026-06-07'
  -- weekly  → 'YYYY-WNN'    e.g. '2026-W23'
  -- monthly → 'YYYY-MM'     e.g. '2026-06'
  -- all_time→ 'all_time'    literal
  CHECK (
    (period_type = 'all_time' AND period_id = 'all_time') OR
    (period_type = 'daily'    AND period_id GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]') OR
    (period_type = 'weekly'   AND period_id GLOB '[0-9][0-9][0-9][0-9]-W[0-9][0-9]') OR
    (period_type = 'monthly'  AND period_id GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]')
  )
);

-- Primary leaderboard query: rank by stars for a given period
-- e.g. SELECT uid, stars_gained FROM user_period_scores
--      WHERE period_type='weekly' AND period_id='2026-W23'
--      ORDER BY stars_gained DESC LIMIT 50;
CREATE INDEX IF NOT EXISTS idx_period_scores_stars
  ON user_period_scores(period_type, period_id, stars_gained DESC);

-- "Bölüm Fatihleri" leaderboard: rank by levels completed
CREATE INDEX IF NOT EXISTS idx_period_scores_levels
  ON user_period_scores(period_type, period_id, levels_done DESC);

-- ─── 3. user_world_records ───────────────────────────────────────────────────
-- Tracks how many world records (best move-count solution) each user holds.
-- period_type : 'daily' | 'weekly' | 'all_time'
-- period_id   : date/week string or 'all_time'
--
-- Semantics:
--   all_time  → current active record count (Phase 4: +1 on new record, -1 on previous holder)
--   daily/weekly → number of NEW records broken in that period (never decremented)
--
-- Security notes:
--   • records_count >= 0 prevents the all_time counter from going negative
--     if a decrement bug or race condition occurs in Phase 4.
--   • Cross-column period format validation (same pattern as user_period_scores).
--   • 'monthly' is not valid here (only daily/weekly/all_time per plan spec).

CREATE TABLE IF NOT EXISTS user_world_records (
  uid           TEXT    NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
  period_type   TEXT    NOT NULL CHECK (period_type IN ('daily', 'weekly', 'all_time')),
  period_id     TEXT    NOT NULL CHECK (length(period_id) BETWEEN 1 AND 20),
  records_count INTEGER NOT NULL DEFAULT 0 CHECK (records_count >= 0),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (uid, period_type, period_id),
  -- Cross-column: period_id format must match period_type
  CHECK (
    (period_type = 'all_time' AND period_id = 'all_time') OR
    (period_type = 'daily'    AND period_id GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]') OR
    (period_type = 'weekly'   AND period_id GLOB '[0-9][0-9][0-9][0-9]-W[0-9][0-9]')
  )
);

-- "Rekortmenler" leaderboard query
CREATE INDEX IF NOT EXISTS idx_world_records_lookup
  ON user_world_records(period_type, period_id, records_count DESC);

-- ─── 4. creator_scores ───────────────────────────────────────────────────────
-- Tracks community level creator scores.
-- A creator earns points when OTHER players complete their levels.
-- period_type : 'monthly' | 'all_time'
-- period_id   : '2026-06' | 'all_time'
-- Counted only for levels in the approved `levels/` Firestore collection.
-- Self-plays (createdBy === uid of completer) are excluded (Phase 5).
--
-- Security notes:
--   • Only 'monthly' and 'all_time' period_types are valid (per plan).
--   • Cross-column format validation ensures monthly uses 'YYYY-MM' format.
--   • plays_gained and stars_gained cannot go negative.

CREATE TABLE IF NOT EXISTS creator_scores (
  uid          TEXT    NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
  period_type  TEXT    NOT NULL CHECK (period_type IN ('monthly', 'all_time')),
  period_id    TEXT    NOT NULL CHECK (length(period_id) BETWEEN 1 AND 20),
  plays_gained INTEGER NOT NULL DEFAULT 0 CHECK (plays_gained >= 0),
  stars_gained INTEGER NOT NULL DEFAULT 0 CHECK (stars_gained >= 0),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (uid, period_type, period_id),
  -- Cross-column: period_id format must match period_type
  CHECK (
    (period_type = 'all_time' AND period_id = 'all_time') OR
    (period_type = 'monthly'  AND period_id GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]')
  )
);

-- "Usta Mimarlar" leaderboard query: rank by plays (primary) then stars (tiebreak)
CREATE INDEX IF NOT EXISTS idx_creator_scores_lookup
  ON creator_scores(period_type, period_id, plays_gained DESC, stars_gained DESC);

-- ─── 5. badges ───────────────────────────────────────────────────────────────
-- Awarded automatically by the weekly/monthly cron (Phase 7).
-- badge_type examples: 'weekly_stars_1st', 'weekly_stars_top3',
--                      'weekly_levels_1st', 'weekly_records_1st',
--                      'monthly_creator_1st', 'monthly_creator_top3'
-- A user cannot receive the same badge_type for the same period_id twice.
--
-- Security notes:
--   • badge_type: 1–64 chars. Longest planned type is ~30 chars.
--   • period_id: 1–20 chars.
--   • rank: BETWEEN 1 AND 10. Plan mentions top-3 / top-10 awards only;
--     bounding this prevents nonsensical rank values from cron bugs.
--   • UNIQUE index on (uid, badge_type, period_id) prevents duplicate awards
--     even if the cron job runs multiple times (idempotent).

CREATE TABLE IF NOT EXISTS badges (
  id         TEXT    NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  uid        TEXT    NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
  badge_type TEXT    NOT NULL CHECK (length(badge_type) BETWEEN 1 AND 64),
  period_id  TEXT    NOT NULL CHECK (length(period_id) BETWEEN 1 AND 20),
  rank       INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 10),
  awarded_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- GET /badges/:uid — all badges for a user, newest first
CREATE INDEX IF NOT EXISTS idx_badges_uid
  ON badges(uid, awarded_at DESC);

-- Prevent duplicate badge awards (same badge_type + period_id per user).
-- Acts as an idempotency guard for the cron job.
CREATE UNIQUE INDEX IF NOT EXISTS idx_badges_unique
  ON badges(uid, badge_type, period_id);

-- ─── 6. friendships ──────────────────────────────────────────────────────────
-- Symmetric friend relationships.
-- Canonical form: user_a < user_b (lexicographic), so each pair is stored once.
-- status     : 'pending' | 'accepted' | 'blocked'
-- requested_by: uid of whoever sent the friend request
--
-- Security notes:
--   • CHECK (user_a < user_b) prevents:
--       - Self-friendship  (uid < uid is always false)
--       - Duplicate pairs stored in reversed order
--   • CHECK (requested_by = user_a OR requested_by = user_b) prevents
--     a third party from injecting a friendship record on behalf of two others.
--   • status enum CHECK prevents arbitrary status values.
--   • All uid fields have length bounds.

CREATE TABLE IF NOT EXISTS friendships (
  user_a       TEXT NOT NULL CHECK (length(user_a) BETWEEN 1 AND 128),
  user_b       TEXT NOT NULL CHECK (length(user_b) BETWEEN 1 AND 128),
  status       TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'blocked')),
  requested_by TEXT NOT NULL CHECK (length(requested_by) BETWEEN 1 AND 128),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_a, user_b),
  -- Enforce canonical ordering: user_a must be lexicographically less than user_b.
  -- This also implicitly prevents self-friendship (X < X is always false).
  CHECK (user_a < user_b),
  -- requested_by must be one of the two parties in the relationship.
  -- Prevents a third party from creating a friendship record without consent.
  CHECK (requested_by = user_a OR requested_by = user_b)
);

-- Queries from user_a's perspective (e.g. "get my friends list")
CREATE INDEX IF NOT EXISTS idx_friendships_user_a
  ON friendships(user_a, status);

-- Queries from user_b's perspective (reverse lookup)
CREATE INDEX IF NOT EXISTS idx_friendships_user_b
  ON friendships(user_b, status);
