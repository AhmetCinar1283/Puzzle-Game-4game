import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

// Mock auth service to avoid actual Google JWKS network requests
vi.mock('../src/services/auth', () => {
  return {
    verifyIdToken: vi.fn(async (token: string, projectId: string) => {
      if (token === 'valid-token-user-1') {
        return { uid: 'user-1' };
      }
      if (token === 'valid-token-user-2') {
        return { uid: 'user-2' };
      }
      if (token === 'valid-token-user-3') {
        return { uid: 'user-3' };
      }
      if (token === 'valid-token-unranked') {
        return { uid: 'user-unranked' };
      }
      throw new Error('Invalid token');
    }),
  };
});

const SCHEMA_STATEMENTS = [
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

describe('Leaderboard HTTP API', () => {
  const db = env.AUDIT_DB;

  beforeAll(async () => {
    // Build tables
    for (const stmt of SCHEMA_STATEMENTS) {
      await db.prepare(stmt).run();
    }
  });

  beforeEach(async () => {
    // Clear data
    await db.prepare('DELETE FROM user_period_scores').run();
    await db.prepare('DELETE FROM user_world_records').run();
    await db.prepare('DELETE FROM creator_scores').run();
    await db.prepare('DELETE FROM user_profiles').run();

    // Seed User Profiles
    await db.prepare(`INSERT INTO user_profiles (uid, display_name, tag) VALUES ('user-1', 'User One', 'U1')`).run();
    await db.prepare(`INSERT INTO user_profiles (uid, display_name, tag) VALUES ('user-2', 'User Two', 'U2')`).run();
    await db.prepare(`INSERT INTO user_profiles (uid, display_name, tag) VALUES ('user-3', 'User Three', NULL)`).run();

    // Seed Scores (2026-W23 / 2026-06-07 / 2026-06)
    // user-3 has same score but earlier update than user-1 (updated_at values)
    await db.prepare(`
      INSERT INTO user_period_scores (uid, period_type, period_id, stars_gained, levels_done, updated_at)
      VALUES ('user-1', 'weekly', '2026-W23', 50, 5, '2026-06-07T10:00:00.000Z')
    `).run();
    await db.prepare(`
      INSERT INTO user_period_scores (uid, period_type, period_id, stars_gained, levels_done, updated_at)
      VALUES ('user-2', 'weekly', '2026-W23', 30, 8, '2026-06-07T11:00:00.000Z')
    `).run();
    await db.prepare(`
      INSERT INTO user_period_scores (uid, period_type, period_id, stars_gained, levels_done, updated_at)
      VALUES ('user-3', 'weekly', '2026-W23', 50, 3, '2026-06-07T09:00:00.000Z')
    `).run();

    // Seed Records (daily 2026-06-07)
    await db.prepare(`
      INSERT INTO user_world_records (uid, period_type, period_id, records_count, updated_at)
      VALUES ('user-1', 'daily', '2026-06-07', 5, '2026-06-07T10:00:00.000Z')
    `).run();
    await db.prepare(`
      INSERT INTO user_world_records (uid, period_type, period_id, records_count, updated_at)
      VALUES ('user-2', 'daily', '2026-06-07', 3, '2026-06-07T11:00:00.000Z')
    `).run();

    // Seed Creator Scores (monthly 2026-06)
    await db.prepare(`
      INSERT INTO creator_scores (uid, period_type, period_id, plays_gained, stars_gained, updated_at)
      VALUES ('user-1', 'monthly', '2026-06', 5, 15, '2026-06-07T10:00:00.000Z')
    `).run();
    await db.prepare(`
      INSERT INTO creator_scores (uid, period_type, period_id, plays_gained, stars_gained, updated_at)
      VALUES ('user-2', 'monthly', '2026-06', 10, 30, '2026-06-07T10:00:00.000Z')
    `).run();
  });

  it('fails for invalid category or period combination', async () => {
    const ctx = createExecutionContext();

    // Invalid category
    const res1 = await worker.fetch(new IncomingRequest('http://localhost/leaderboard/unsupported/weekly'), env, ctx);
    expect(res1.status).toBe(400);
    const json1 = await res1.json<any>();
    expect(json1.success).toBe(false);
    expect(json1.error).toBe('Invalid category');

    // Invalid period
    const res2 = await worker.fetch(new IncomingRequest('http://localhost/leaderboard/stars/monthly'), env, ctx);
    expect(res2.status).toBe(400);
    const json2 = await res2.json<any>();
    expect(json2.success).toBe(false);
    expect(json2.error).toBe('Invalid period for this category');
  });

  it('returns standard leaderboard with correct ranking and tie-breaks', async () => {
    const ctx = createExecutionContext();
    const req = new IncomingRequest('http://localhost/leaderboard/stars/weekly?periodId=2026-W23');
    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);

    const json = await res.json<any>();
    expect(json.success).toBe(true);
    expect(json.category).toBe('stars');
    expect(json.period).toBe('weekly');
    expect(json.periodId).toBe('2026-W23');
    expect(json.totalPlayers).toBe(3);

    // Order: user-3 (50 stars, early updated_at), user-1 (50 stars, late updated_at), user-2 (30 stars)
    expect(json.entries.length).toBe(3);
    expect(json.entries[0]).toEqual({
      rank: 1,
      uid: 'user-3',
      displayName: 'User Three',
      tag: null,
      showcaseBadges: [],
      value: 50
    });
    expect(json.entries[1]).toEqual({
      rank: 2,
      uid: 'user-1',
      displayName: 'User One',
      tag: 'U1',
      showcaseBadges: [],
      value: 50
    });
    expect(json.entries[2]).toEqual({
      rank: 3,
      uid: 'user-2',
      displayName: 'User Two',
      tag: 'U2',
      showcaseBadges: [],
      value: 30
    });
  });

  it('correctly handles limit parameter', async () => {
    const ctx = createExecutionContext();
    const req = new IncomingRequest('http://localhost/leaderboard/stars/weekly?periodId=2026-W23&limit=2');
    const res = await worker.fetch(req, env, ctx);
    const json = await res.json<any>();

    expect(json.success).toBe(true);
    expect(json.entries.length).toBe(2);
    expect(json.entries[0].uid).toBe('user-3');
    expect(json.entries[1].uid).toBe('user-1');
  });

  it('returns myRank and myValue for authenticated user', async () => {
    const ctx = createExecutionContext();
    const req = new IncomingRequest('http://localhost/leaderboard/stars/weekly?periodId=2026-W23', {
      headers: { Authorization: 'Bearer valid-token-user-1' }
    });
    const res = await worker.fetch(req, env, ctx);
    const json = await res.json<any>();

    expect(json.success).toBe(true);
    expect(json.myRank).toBe(2); // user-1 is rank 2
    expect(json.myValue).toBe(50);
  });

  it('returns myRank=null and myValue=0 for authenticated user with no entry', async () => {
    const ctx = createExecutionContext();
    const req = new IncomingRequest('http://localhost/leaderboard/stars/weekly?periodId=2026-W23', {
      headers: { Authorization: 'Bearer valid-token-unranked' }
    });
    const res = await worker.fetch(req, env, ctx);
    const json = await res.json<any>();

    expect(json.success).toBe(true);
    expect(json.myRank).toBeNull();
    expect(json.myValue).toBe(0);
  });

  it('fails with 401 when around_me=true is requested anonymously', async () => {
    const ctx = createExecutionContext();
    const req = new IncomingRequest('http://localhost/leaderboard/stars/weekly?periodId=2026-W23&around_me=true');
    const res = await worker.fetch(req, env, ctx);

    expect(res.status).toBe(401);
    const json = await res.json<any>();
    expect(json.success).toBe(false);
  });

  it('returns around_me results when authenticated', async () => {
    const ctx = createExecutionContext();
    const req = new IncomingRequest('http://localhost/leaderboard/stars/weekly?periodId=2026-W23&around_me=true', {
      headers: { Authorization: 'Bearer valid-token-user-2' }
    });
    const res = await worker.fetch(req, env, ctx);
    const json = await res.json<any>();

    expect(json.success).toBe(true);
    expect(json.myRank).toBe(3); // user-2 rank is 3
    expect(json.entries.length).toBe(3); // returns all since total is 3
    expect(json.entries[0].uid).toBe('user-3');
    expect(json.entries[1].uid).toBe('user-1');
    expect(json.entries[2].uid).toBe('user-2');
  });

  it('returns creators leaderboard with monthly period', async () => {
    const ctx = createExecutionContext();
    const req = new IncomingRequest('http://localhost/leaderboard/creators/monthly?periodId=2026-06');
    const res = await worker.fetch(req, env, ctx);
    const json = await res.json<any>();

    expect(json.success).toBe(true);
    expect(json.category).toBe('creators');
    expect(json.period).toBe('monthly');
    expect(json.entries.length).toBe(2);

    // user-2 has 10 plays, user-1 has 5 plays
    expect(json.entries[0].uid).toBe('user-2');
    expect(json.entries[0].value).toBe(10);
    expect(json.entries[1].uid).toBe('user-1');
    expect(json.entries[1].value).toBe(5);
  });

  it('fails with 401 when invalid token is provided', async () => {
    const ctx = createExecutionContext();
    const req = new IncomingRequest('http://localhost/leaderboard/stars/weekly?periodId=2026-W23', {
      headers: { Authorization: 'Bearer bad-token' }
    });
    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(401);
    const json = await res.json<any>();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Invalid or expired token');
  });
});
