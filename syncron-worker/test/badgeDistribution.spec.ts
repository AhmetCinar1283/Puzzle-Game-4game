import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { runBadgeDistribution } from '../src/scheduled/badgeDistribution';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS user_profiles (
    uid          TEXT NOT NULL PRIMARY KEY CHECK (length(uid) BETWEEN 1 AND 128),
    display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
    tag          TEXT UNIQUE CHECK (tag IS NULL OR length(tag) BETWEEN 2 AND 20),
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
  )`,
  `CREATE TABLE IF NOT EXISTS badges (
    id         TEXT    NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    uid        TEXT    NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
    badge_type TEXT    NOT NULL CHECK (length(badge_type) BETWEEN 1 AND 64),
    period_id  TEXT    NOT NULL CHECK (length(period_id) BETWEEN 1 AND 20),
    rank       INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 10),
    awarded_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_badges_unique ON badges(uid, badge_type, period_id)`
];

describe('Badge Distribution Cron', () => {
  const db = env.AUDIT_DB;

  beforeAll(async () => {
    for (const stmt of SCHEMA_STATEMENTS) {
      await db.prepare(stmt).run();
    }
  });

  beforeEach(async () => {
    await db.prepare('DELETE FROM user_period_scores').run();
    await db.prepare('DELETE FROM user_world_records').run();
    await db.prepare('DELETE FROM creator_scores').run();
    await db.prepare('DELETE FROM badges').run();
  });

  it('correctly distributes weekly badges for stars, levels and records', async () => {
    // Seed weekly scores for period 2026-W23
    // We want user-1 (1st), user-2 (2nd), user-3 (3rd), user-4 (4th)
    await db.prepare(`
      INSERT INTO user_period_scores (uid, period_type, period_id, stars_gained, levels_done, updated_at)
      VALUES
        ('user-1', 'weekly', '2026-W23', 50, 2, '2026-06-07T10:00:00Z'),
        ('user-2', 'weekly', '2026-W23', 40, 5, '2026-06-07T10:00:00Z'),
        ('user-3', 'weekly', '2026-W23', 30, 4, '2026-06-07T10:00:00Z'),
        ('user-4', 'weekly', '2026-W23', 20, 1, '2026-06-07T10:00:00Z')
    `).run();

    // Seed world records for 2026-W23
    await db.prepare(`
      INSERT INTO user_world_records (uid, period_type, period_id, records_count, updated_at)
      VALUES
        ('user-3', 'weekly', '2026-W23', 10, '2026-06-07T10:00:00Z'),
        ('user-2', 'weekly', '2026-W23', 8, '2026-06-07T10:00:00Z'),
        ('user-1', 'weekly', '2026-W23', 5, '2026-06-07T10:00:00Z')
    `).run();

    // Cron triggers at Monday 2026-06-08 00:05:00 UTC
    // Previous period should resolve to 2026-W23 (Sunday 2026-06-07 was in W23)
    const runDate = new Date(Date.UTC(2026, 5, 8, 0, 5, 0)); // June is 5

    await runBadgeDistribution(env, 'weekly', runDate);

    // Verify weekly_stars badges
    const starsBadges = await db.prepare(`
      SELECT uid, badge_type, rank FROM badges
      WHERE badge_type LIKE 'weekly_stars%' AND period_id = '2026-W23'
      ORDER BY rank ASC
    `).all<{ uid: string; badge_type: string; rank: number }>();

    expect(starsBadges.results.length).toBe(3);
    expect(starsBadges.results[0]).toEqual({ uid: 'user-1', badge_type: 'weekly_stars_1st', rank: 1 });
    expect(starsBadges.results[1]).toEqual({ uid: 'user-2', badge_type: 'weekly_stars_top3', rank: 2 });
    expect(starsBadges.results[2]).toEqual({ uid: 'user-3', badge_type: 'weekly_stars_top3', rank: 3 });

    // Verify weekly_levels badges
    // Order of completed levels: user-2 (5), user-3 (4), user-1 (2)
    const levelsBadges = await db.prepare(`
      SELECT uid, badge_type, rank FROM badges
      WHERE badge_type LIKE 'weekly_levels%' AND period_id = '2026-W23'
      ORDER BY rank ASC
    `).all<{ uid: string; badge_type: string; rank: number }>();

    expect(levelsBadges.results.length).toBe(3);
    expect(levelsBadges.results[0]).toEqual({ uid: 'user-2', badge_type: 'weekly_levels_1st', rank: 1 });
    expect(levelsBadges.results[1]).toEqual({ uid: 'user-3', badge_type: 'weekly_levels_top3', rank: 2 });
    expect(levelsBadges.results[2]).toEqual({ uid: 'user-1', badge_type: 'weekly_levels_top3', rank: 3 });

    // Verify weekly_records badges
    // Order of records: user-3 (10), user-2 (8), user-1 (5)
    const recordsBadges = await db.prepare(`
      SELECT uid, badge_type, rank FROM badges
      WHERE badge_type LIKE 'weekly_records%' AND period_id = '2026-W23'
      ORDER BY rank ASC
    `).all<{ uid: string; badge_type: string; rank: number }>();

    expect(recordsBadges.results.length).toBe(3);
    expect(recordsBadges.results[0]).toEqual({ uid: 'user-3', badge_type: 'weekly_records_1st', rank: 1 });
    expect(recordsBadges.results[1]).toEqual({ uid: 'user-2', badge_type: 'weekly_records_top3', rank: 2 });
    expect(recordsBadges.results[2]).toEqual({ uid: 'user-1', badge_type: 'weekly_records_top3', rank: 3 });
  });

  it('correctly distributes monthly badges for creators', async () => {
    // Seed creator scores for period 2026-05 (previous month)
    await db.prepare(`
      INSERT INTO creator_scores (uid, period_type, period_id, plays_gained, stars_gained, updated_at)
      VALUES
        ('creator-1', 'monthly', '2026-05', 100, 300, '2026-05-31T10:00:00Z'),
        ('creator-2', 'monthly', '2026-05', 150, 450, '2026-05-31T10:00:00Z'),
        ('creator-3', 'monthly', '2026-05', 50, 150, '2026-05-31T10:00:00Z')
    `).run();

    // Cron triggers at Monday 2026-06-01 00:05:00 UTC
    // Previous period should resolve to 2026-05 (May 2026)
    const runDate = new Date(Date.UTC(2026, 5, 1, 0, 5, 0)); // June 1st

    await runBadgeDistribution(env, 'monthly', runDate);

    // Verify monthly creator badges
    // Order: creator-2 (150 plays), creator-1 (100 plays), creator-3 (50 plays)
    const creatorBadges = await db.prepare(`
      SELECT uid, badge_type, rank FROM badges
      WHERE badge_type LIKE 'monthly_creator%' AND period_id = '2026-05'
      ORDER BY rank ASC
    `).all<{ uid: string; badge_type: string; rank: number }>();

    expect(creatorBadges.results.length).toBe(3);
    expect(creatorBadges.results[0]).toEqual({ uid: 'creator-2', badge_type: 'monthly_creator_1st', rank: 1 });
    expect(creatorBadges.results[1]).toEqual({ uid: 'creator-1', badge_type: 'monthly_creator_top3', rank: 2 });
    expect(creatorBadges.results[2]).toEqual({ uid: 'creator-3', badge_type: 'monthly_creator_top3', rank: 3 });
  });

  it('guarantees idempotence by not creating duplicate badges if run twice', async () => {
    // Seed weekly scores for period 2026-W23
    await db.prepare(`
      INSERT INTO user_period_scores (uid, period_type, period_id, stars_gained, levels_done, updated_at)
      VALUES ('user-1', 'weekly', '2026-W23', 50, 2, '2026-06-07T10:00:00Z')
    `).run();

    const runDate = new Date(Date.UTC(2026, 5, 8, 0, 5, 0));

    // Run first time
    await runBadgeDistribution(env, 'weekly', runDate);

    // Run second time (should ignore duplicate key conflicts without throwing)
    await expect(runBadgeDistribution(env, 'weekly', runDate)).resolves.not.toThrow();

    // Verify only one badge was awarded
    const badgesCount = await db.prepare(`
      SELECT COUNT(*) as count FROM badges
      WHERE uid = 'user-1' AND period_id = '2026-W23' AND badge_type = 'weekly_stars_1st'
    `).first<{ count: number }>();

    expect(badgesCount?.count).toBe(1);
  });
});
