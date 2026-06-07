import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { getCurrentPeriodIds, upsertPeriodScores, upsertUserProfile, upsertWorldRecords, upsertCreatorScores } from '../src/services/leaderboard';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id         TEXT    NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    uid        TEXT    NOT NULL,
    action     TEXT    NOT NULL,
    category   TEXT    NOT NULL,
    metadata   TEXT    NOT NULL DEFAULT '{}',
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`,
  `CREATE TABLE IF NOT EXISTS user_profiles (
    uid          TEXT NOT NULL PRIMARY KEY CHECK (length(uid) BETWEEN 1 AND 128),
    display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
    tag          TEXT UNIQUE CHECK (tag IS NULL OR length(tag) BETWEEN 2 AND 20),
    showcase_badges TEXT DEFAULT NULL,
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`,
  `CREATE TABLE IF NOT EXISTS user_period_scores (
    uid          TEXT    NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
    period_type  TEXT    NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
    period_id    TEXT    NOT NULL CHECK (length(period_id) BETWEEN 1 AND 20),
    stars_gained INTEGER NOT NULL DEFAULT 0 CHECK (stars_gained >= 0),
    levels_done  INTEGER NOT NULL DEFAULT 0 CHECK (levels_done >= 0),
    updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (uid, period_type, period_id),
    CHECK (
      (period_type = 'all_time' AND period_id = 'all_time') OR
      (period_type = 'daily'    AND period_id GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]') OR
      (period_type = 'weekly'   AND period_id GLOB '[0-9][0-9][0-9][0-9]-W[0-9][0-9]') OR
      (period_type = 'monthly'  AND period_id GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]')
    )
  )`,
  `CREATE TABLE IF NOT EXISTS user_world_records (
    uid           TEXT    NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
    period_type   TEXT    NOT NULL CHECK (period_type IN ('daily', 'weekly', 'all_time')),
    period_id     TEXT    NOT NULL CHECK (length(period_id) BETWEEN 1 AND 20),
    records_count INTEGER NOT NULL DEFAULT 0 CHECK (records_count >= 0),
    updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (uid, period_type, period_id),
    CHECK (
      (period_type = 'all_time' AND period_id = 'all_time') OR
      (period_type = 'daily'    AND period_id GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]') OR
      (period_type = 'weekly'   AND period_id GLOB '[0-9][0-9][0-9][0-9]-W[0-9][0-9]')
    )
  )`,
  `CREATE TABLE IF NOT EXISTS creator_scores (
    uid          TEXT    NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
    period_type  TEXT    NOT NULL CHECK (period_type IN ('monthly', 'all_time')),
    period_id    TEXT    NOT NULL CHECK (length(period_id) BETWEEN 1 AND 20),
    plays_gained INTEGER NOT NULL DEFAULT 0 CHECK (plays_gained >= 0),
    stars_gained INTEGER NOT NULL DEFAULT 0 CHECK (stars_gained >= 0),
    updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (uid, period_type, period_id),
    CHECK (
      (period_type = 'all_time' AND period_id = 'all_time') OR
      (period_type = 'monthly'  AND period_id GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]')
    )
  )`
];

describe('Leaderboard Service', () => {
  describe('getCurrentPeriodIds', () => {
    it('generates correct period IDs for Sunday 2026-06-07', () => {
      const date = new Date(Date.UTC(2026, 5, 7)); // Month is 0-indexed (5 = June)
      const periods = getCurrentPeriodIds(date);

      expect(periods.daily).toBe('2026-06-07');
      expect(periods.weekly).toBe('2026-W23');
      expect(periods.monthly).toBe('2026-06');
      expect(periods.allTime).toBe('all_time');
    });

    it('generates correct period IDs for Thursday 2026-01-01', () => {
      const date = new Date(Date.UTC(2026, 0, 1));
      const periods = getCurrentPeriodIds(date);

      expect(periods.daily).toBe('2026-01-01');
      expect(periods.weekly).toBe('2026-W01');
      expect(periods.monthly).toBe('2026-01');
    });

    it('generates correct period IDs for Monday 2025-12-29 (start of 2026-W01)', () => {
      const date = new Date(Date.UTC(2025, 11, 29));
      const periods = getCurrentPeriodIds(date);

      expect(periods.daily).toBe('2025-12-29');
      expect(periods.weekly).toBe('2026-W01');
      expect(periods.monthly).toBe('2025-12');
    });
  });

  describe('D1 Database Operations', () => {
    const db = env.AUDIT_DB;
    const testUid = 'test-user-123';

    beforeAll(async () => {
      // Run each CREATE TABLE statement
      for (const statement of SCHEMA_STATEMENTS) {
        await db.prepare(statement).run();
      }
    });

    beforeEach(async () => {
      // Clean up test tables if they have data
      await db.prepare('DELETE FROM user_period_scores WHERE uid = ?1').bind(testUid).run();
      await db.prepare('DELETE FROM user_profiles WHERE uid = ?1').bind(testUid).run();
      await db.prepare('DELETE FROM user_world_records WHERE uid = ?1').bind(testUid).run();
      await db.prepare('DELETE FROM creator_scores WHERE uid = ?1').bind(testUid).run();
    });

    it('should upsert period scores correctly', async () => {
      // Initial upsert (isFirstCompletion = true)
      await upsertPeriodScores(db, testUid, 3, true);

      const res = await db.prepare('SELECT * FROM user_period_scores WHERE uid = ?1 AND period_type = ?2')
        .bind(testUid, 'all_time')
        .first<{ stars_gained: number; levels_done: number }>();

      expect(res).toBeDefined();
      expect(res?.stars_gained).toBe(3);
      expect(res?.levels_done).toBe(1);

      // Subsequent upsert (scoreDelta = 1, isFirstCompletion = false)
      await upsertPeriodScores(db, testUid, 1, false);

      const resAfter = await db.prepare('SELECT * FROM user_period_scores WHERE uid = ?1 AND period_type = ?2')
        .bind(testUid, 'all_time')
        .first<{ stars_gained: number; levels_done: number }>();

      expect(resAfter?.stars_gained).toBe(4);
      expect(resAfter?.levels_done).toBe(1); // Should stay 1
    });

    it('should upsert user profiles with sanitization', async () => {
      const longName = 'A'.repeat(150); // DB limit: 100
      const longTag = 'B'.repeat(30);   // DB limit: 20

      await upsertUserProfile(db, testUid, longName, longTag);

      const profile = await db.prepare('SELECT * FROM user_profiles WHERE uid = ?1')
        .bind(testUid)
        .first<{ display_name: string; tag: string | null }>();

      expect(profile).toBeDefined();
      expect(profile?.display_name.length).toBe(100);
      expect(profile?.tag).toBeNull();
    });

    it('should upsert world records and decrement previous holders', async () => {
      const oldHolder = 'old-holder-999';
      await db.prepare('DELETE FROM user_world_records WHERE uid = ?1').bind(oldHolder).run();

      // Seed old holder record count
      await db.prepare(`
        INSERT INTO user_world_records (uid, period_type, period_id, records_count)
        VALUES (?1, 'all_time', 'all_time', 2)
      `).bind(oldHolder).run();

      // New holder breaks the record
      await upsertWorldRecords(db, testUid, oldHolder);

      // Verify new holder got +1
      const newHolderRes = await db.prepare('SELECT * FROM user_world_records WHERE uid = ?1 AND period_type = ?2')
        .bind(testUid, 'all_time')
        .first<{ records_count: number }>();
      expect(newHolderRes?.records_count).toBe(1);

      // Verify old holder got -1
      const oldHolderRes = await db.prepare('SELECT * FROM user_world_records WHERE uid = ?1 AND period_type = ?2')
        .bind(oldHolder, 'all_time')
        .first<{ records_count: number }>();
      expect(oldHolderRes?.records_count).toBe(1);
    });

    it('should upsert creator scores correctly', async () => {
      const creatorUid = 'creator-888';
      await db.prepare('DELETE FROM creator_scores WHERE uid = ?1').bind(creatorUid).run();

      await upsertCreatorScores(db, creatorUid, 3);

      const creatorRes = await db.prepare('SELECT * FROM creator_scores WHERE uid = ?1 AND period_type = ?2')
        .bind(creatorUid, 'all_time')
        .first<{ plays_gained: number; stars_gained: number }>();

      expect(creatorRes).toBeDefined();
      expect(creatorRes?.plays_gained).toBe(1);
      expect(creatorRes?.stars_gained).toBe(3);
    });
  });
});
