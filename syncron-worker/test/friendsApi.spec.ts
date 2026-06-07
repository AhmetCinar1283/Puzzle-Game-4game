import { env, createExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

// Mock Auth
vi.mock('../src/services/auth', () => {
  return {
    verifyIdToken: vi.fn(async (token: string) => {
      if (token.startsWith('valid-token-')) {
        const uid = token.slice(12);
        return { uid };
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
  `CREATE TABLE IF NOT EXISTS friendships (
    user_a       TEXT NOT NULL CHECK (length(user_a) BETWEEN 1 AND 128),
    user_b       TEXT NOT NULL CHECK (length(user_b) BETWEEN 1 AND 128),
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    requested_by TEXT NOT NULL CHECK (length(requested_by) BETWEEN 1 AND 128),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (user_a, user_b),
    CHECK (user_a < user_b),
    CHECK (requested_by = user_a OR requested_by = user_b)
  )`,
  `CREATE TABLE IF NOT EXISTS user_period_scores (
    uid          TEXT    NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
    period_type  TEXT    NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
    period_id    TEXT    NOT NULL CHECK (length(period_id) BETWEEN 1 AND 20),
    stars_gained INTEGER NOT NULL DEFAULT 0 CHECK (stars_gained >= 0),
    levels_done  INTEGER NOT NULL DEFAULT 0 CHECK (levels_done >= 0),
    updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (uid, period_type, period_id)
  )`
];

describe('Friends & Friend Leaderboard API', () => {
  const db = env.AUDIT_DB;

  beforeAll(async () => {
    for (const stmt of SCHEMA_STATEMENTS) {
      await db.prepare(stmt).run();
    }
  });

  beforeEach(async () => {
    await db.prepare('DELETE FROM friendships').run();
    await db.prepare('DELETE FROM user_period_scores').run();
    await db.prepare('DELETE FROM user_profiles').run();

    // Seed User Profiles
    await db.prepare(`INSERT INTO user_profiles (uid, display_name, tag) VALUES ('user-1', 'User One', 'U1')`).run();
    await db.prepare(`INSERT INTO user_profiles (uid, display_name, tag) VALUES ('user-2', 'User Two', 'U2')`).run();
    await db.prepare(`INSERT INTO user_profiles (uid, display_name, tag, showcase_badges) VALUES ('user-3', 'User Three', 'U3', '[{"id":"badge-1","badgeType":"weekly_stars_1st","periodId":"2026-W23","rank":1,"awardedAt":"2026-06-07T10:00:00Z"}]')`).run();
    await db.prepare(`INSERT INTO user_profiles (uid, display_name, tag) VALUES ('user-4', 'User Four', 'U4')`).run();
    await db.prepare(`INSERT INTO user_profiles (uid, display_name, tag) VALUES ('user-5', 'User Five', 'U5')`).run();

    // Seed Scores
    await db.prepare(`
      INSERT INTO user_period_scores (uid, period_type, period_id, stars_gained, levels_done, updated_at)
      VALUES
        ('user-1', 'weekly', '2026-W23', 10, 2, '2026-06-07T10:00:00Z'),
        ('user-2', 'weekly', '2026-W23', 30, 5, '2026-06-07T11:00:00Z'),
        ('user-3', 'weekly', '2026-W23', 20, 3, '2026-06-07T12:00:00Z'),
        ('user-4', 'weekly', '2026-W23', 40, 7, '2026-06-07T13:00:00Z')
    `).run();
  });

  describe('POST /friends/request', () => {
    it('fails with 401 when not authenticated', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid: 'user-2' }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(401);
    });

    it('sends friend request successfully using UID', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ targetUid: 'user-2' }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const json = await res.json<any>();
      expect(json.success).toBe(true);

      // Verify db
      const friendship = await db
        .prepare("SELECT status, requested_by FROM friendships WHERE user_a = 'user-1' AND user_b = 'user-2'")
        .first<{ status: string; requested_by: string }>();
      expect(friendship).toBeDefined();
      expect(friendship?.status).toBe('pending');
      expect(friendship?.requested_by).toBe('user-1');
    });

    it('sends friend request successfully using Tag', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ targetTag: 'U3' }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const json = await res.json<any>();
      expect(json.success).toBe(true);

      const friendship = await db
        .prepare("SELECT status, requested_by FROM friendships WHERE user_a = 'user-1' AND user_b = 'user-3'")
        .first<{ status: string; requested_by: string }>();
      expect(friendship?.status).toBe('pending');
      expect(friendship?.requested_by).toBe('user-1');
    });

    it('fails when sending request to self', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ targetUid: 'user-1' }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(400);

      const json = await res.json<any>();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Cannot send friend request to yourself');
    });

    it('fails when target tag is not found', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ targetTag: 'NONEXIST' }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(404);

      const json = await res.json<any>();
      expect(json.success).toBe(false);
      expect(json.error).toBe('User profile with this tag not found');
    });

    it('fails when friend request is already pending', async () => {
      // Seed pending request
      await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ('user-1', 'user-2', 'pending', 'user-1')`).run();

      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ targetUid: 'user-2' }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(400);

      const json = await res.json<any>();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Friend request already pending');
    });

    it('fails when users are already friends', async () => {
      // Seed accepted request
      await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ('user-1', 'user-2', 'accepted', 'user-2')`).run();

      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ targetUid: 'user-2' }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(400);

      const json = await res.json<any>();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Already friends');
    });

    it('enforces limit of 20 pending outgoing requests', async () => {
      // Create 20 pending outgoing requests for user-1
      for (let i = 10; i < 30; i++) {
        const target = `mock-user-${i}`;
        const user_a = 'user-1' < target ? 'user-1' : target;
        const user_b = 'user-1' < target ? target : 'user-1';
        await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES (?1, ?2, 'pending', 'user-1')`).bind(user_a, user_b).run();
      }

      // Try sending 21st request
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ targetUid: 'user-2' }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(400);

      const json = await res.json<any>();
      expect(json.success).toBe(false);
      expect(json.error).toBe('You have reached the limit of 20 pending outgoing requests');
    });

    it('enforces limit of 100 accepted friends', async () => {
      // Create 100 accepted friends for user-1
      for (let i = 10; i < 110; i++) {
        const target = `mock-user-${i}`;
        const user_a = 'user-1' < target ? 'user-1' : target;
        const user_b = 'user-1' < target ? target : 'user-1';
        await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES (?1, ?2, 'accepted', 'user-1')`).bind(user_a, user_b).run();
      }

      // Try sending a request
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ targetUid: 'user-2' }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(400);

      const json = await res.json<any>();
      expect(json.success).toBe(false);
      expect(json.error).toBe('You have reached the maximum limit of 100 friends');
    });
  });

  describe('POST /friends/accept', () => {
    beforeEach(async () => {
      // Seed pending request from user-2 to user-1
      await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ('user-1', 'user-2', 'pending', 'user-2')`).run();
    });

    it('accepts pending request successfully', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ uid: 'user-2' }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const json = await res.json<any>();
      expect(json.success).toBe(true);

      const friendship = await db
        .prepare("SELECT status FROM friendships WHERE user_a = 'user-1' AND user_b = 'user-2'")
        .first<{ status: string }>();
      expect(friendship?.status).toBe('accepted');
    });

    it('fails when trying to accept own request', async () => {
      // Re-seed pending request, requested_by user-1 this time
      await db.prepare("DELETE FROM friendships").run();
      await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ('user-1', 'user-2', 'pending', 'user-1')`).run();

      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ uid: 'user-2' }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(400);

      const json = await res.json<any>();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Cannot accept your own request');
    });

    it('fails when request is not found', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ uid: 'user-5' }), // no request from user-5
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /friends/reject', () => {
    beforeEach(async () => {
      // Seed pending request from user-2 to user-1
      await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ('user-1', 'user-2', 'pending', 'user-2')`).run();
    });

    it('rejects/deletes request successfully', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ uid: 'user-2' }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const json = await res.json<any>();
      expect(json.success).toBe(true);

      const friendship = await db
        .prepare("SELECT status FROM friendships WHERE user_a = 'user-1' AND user_b = 'user-2'")
        .first<{ status: string }>();
      expect(friendship).toBeNull();
    });

    it('fails when trying to reject own request', async () => {
      await db.prepare("DELETE FROM friendships").run();
      await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ('user-1', 'user-2', 'pending', 'user-1')`).run();

      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ uid: 'user-2' }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /friends/:uid', () => {
    it('deletes friendship successfully', async () => {
      // Seed accepted friendship
      await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ('user-1', 'user-2', 'accepted', 'user-1')`).run();

      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/user-2', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer valid-token-user-1',
        },
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const friendship = await db
        .prepare("SELECT status FROM friendships WHERE user_a = 'user-1' AND user_b = 'user-2'")
        .first<{ status: string }>();
      expect(friendship).toBeNull();
    });

    it('returns 404 when friendship is not found or not accepted', async () => {
      // Only pending, not accepted
      await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ('user-1', 'user-2', 'pending', 'user-2')`).run();

      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/user-2', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer valid-token-user-1',
        },
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /friends and GET /friends/requests', () => {
    beforeEach(async () => {
      // user-1 has accepted friend user-3
      // user-1 has pending incoming request from user-2
      await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ('user-1', 'user-3', 'accepted', 'user-3')`).run();
      await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ('user-1', 'user-2', 'pending', 'user-2')`).run();
    });

    it('GET /friends returns accepted friends list with profiles', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends', {
        headers: { Authorization: 'Bearer valid-token-user-1' },
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const json = await res.json<any>();
      expect(json.success).toBe(true);
      expect(json.friends.length).toBe(1);
      expect(json.friends[0].uid).toBe('user-3');
      expect(json.friends[0].displayName).toBe('User Three');
      expect(json.friends[0].tag).toBe('U3');
      expect(json.friends[0].showcaseBadges.length).toBe(1);
      expect(json.friends[0].showcaseBadges[0].id).toBe('badge-1');
    });

    it('GET /friends/requests returns incoming pending requests list', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/friends/requests', {
        headers: { Authorization: 'Bearer valid-token-user-1' },
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const json = await res.json<any>();
      expect(json.success).toBe(true);
      expect(json.requests.length).toBe(1);
      expect(json.requests[0].uid).toBe('user-2');
      expect(json.requests[0].displayName).toBe('User Two');
      expect(json.requests[0].tag).toBe('U2');
    });
  });

  describe('GET /users/search', () => {
    it('returns user by tag with friendshipStatus', async () => {
      // Seed accepted friendship between user-1 and user-3
      await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ('user-1', 'user-3', 'accepted', 'user-1')`).run();

      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/users/search?tag=U3', {
        headers: { Authorization: 'Bearer valid-token-user-1' },
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const json = await res.json<any>();
      expect(json.success).toBe(true);
      expect(json.users.length).toBe(1);
      expect(json.users[0].uid).toBe('user-3');
      expect(json.users[0].friendshipStatus).toBe('accepted');
    });

    it('filters out blocked users', async () => {
      // user-1 has blocked user-2
      await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ('user-1', 'user-2', 'blocked', 'user-1')`).run();

      const ctx = createExecutionContext();
      // Try searching for user-2 (tag U2)
      const req = new IncomingRequest('http://localhost/users/search?tag=U2', {
        headers: { Authorization: 'Bearer valid-token-user-1' },
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const json = await res.json<any>();
      expect(json.success).toBe(true);
      expect(json.users.length).toBe(0); // Should be filtered out
    });
  });

  describe('GET /leaderboard/:category/:period with friends_only=true', () => {
    beforeEach(async () => {
      // user-1 is friends with user-3, but NOT friends with user-2 or user-4
      await db.prepare(`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES ('user-1', 'user-3', 'accepted', 'user-1')`).run();
    });

    it('returns only user and friends ranked', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/leaderboard/stars/weekly?periodId=2026-W23&friends_only=true', {
        headers: { Authorization: 'Bearer valid-token-user-1' },
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const json = await res.json<any>();
      expect(json.success).toBe(true);
      expect(json.totalPlayers).toBe(2); // Only user-1 (10 stars) and user-3 (20 stars)

      expect(json.entries.length).toBe(2);
      // Order: user-3 (20 stars, rank 1), user-1 (10 stars, rank 2)
      expect(json.entries[0].uid).toBe('user-3');
      expect(json.entries[0].rank).toBe(1);
      expect(json.entries[0].value).toBe(20);

      expect(json.entries[1].uid).toBe('user-1');
      expect(json.entries[1].rank).toBe(2);
      expect(json.entries[1].value).toBe(10);

      expect(json.myRank).toBe(2);
      expect(json.myValue).toBe(10);
    });

    it('fails with 401 when anonymous', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/leaderboard/stars/weekly?periodId=2026-W23&friends_only=true');
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(401);
    });
  });

  describe('Security and Hardening', () => {
    it('enforces authentication on all friends endpoints', async () => {
      const ctx = createExecutionContext();
      const endpoints = [
        { path: 'http://localhost/friends', method: 'GET', body: null },
        { path: 'http://localhost/friends/requests', method: 'GET', body: null },
        { path: 'http://localhost/friends/accept', method: 'POST', body: { uid: 'user-2' } },
        { path: 'http://localhost/friends/reject', method: 'POST', body: { uid: 'user-2' } },
        { path: 'http://localhost/friends/user-2', method: 'DELETE', body: null },
        { path: 'http://localhost/users/search?tag=U2', method: 'GET', body: null },
      ];

      for (const ep of endpoints) {
        const req = new IncomingRequest(ep.path, {
          method: ep.method,
          headers: ep.body ? { 'Content-Type': 'application/json' } : undefined,
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });
        const res = await worker.fetch(req, env, ctx);
        expect(res.status).toBe(401);
      }
    });

    it('prevents SQL injection in inputs', async () => {
      const ctx = createExecutionContext();
      
      // SQL injection attempt in targetUid
      const reqRequest = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ targetUid: "user-2' OR '1'='1" }),
      });
      const resRequest = await worker.fetch(reqRequest, env, ctx);
      expect(resRequest.status).toBe(404); // User profile not found

      // SQL injection attempt in tag search (fails Zod schema validation because it is not alphanumeric)
      const reqSearch = new IncomingRequest("http://localhost/users/search?tag=U3' OR '1'='1", {
        headers: { Authorization: 'Bearer valid-token-user-1' },
      });
      const resSearch = await worker.fetch(reqSearch, env, ctx);
      expect(resSearch.status).toBe(400);

      // SQL injection attempt that exceeds Zod tag limit of 20 characters
      const reqSearchLong = new IncomingRequest("http://localhost/users/search?tag=U3' OR '1'='1' OR '2'='2", {
        headers: { Authorization: 'Bearer valid-token-user-1' },
      });
      const resSearchLong = await worker.fetch(reqSearchLong, env, ctx);
      expect(resSearchLong.status).toBe(400); // Length > 20, fails validation

      // SQL injection in DELETE path param
      const reqDelete = new IncomingRequest("http://localhost/friends/user-2' OR '1'='1", {
        method: 'DELETE',
        headers: { Authorization: 'Bearer valid-token-user-1' },
      });
      const resDelete = await worker.fetch(reqDelete, env, ctx);
      expect(resDelete.status).toBe(404); // Not found, bound parameter doesn't match
    });

    it('enforces Zod schema bounds and validation constraints', async () => {
      const ctx = createExecutionContext();

      // targetUid too long
      const reqLongUid = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ targetUid: 'a'.repeat(129) }),
      });
      const resLongUid = await worker.fetch(reqLongUid, env, ctx);
      expect(resLongUid.status).toBe(400);

      // targetTag too long
      const reqLongTag = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ targetTag: 'a'.repeat(21) }),
      });
      const resLongTag = await worker.fetch(reqLongTag, env, ctx);
      expect(resLongTag.status).toBe(400);

      // targetTag too short
      const reqShortTag = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ targetTag: 'a' }),
      });
      const resShortTag = await worker.fetch(reqShortTag, env, ctx);
      expect(resShortTag.status).toBe(400);

      // Invalid JSON payload
      const reqBadJson = new IncomingRequest('http://localhost/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: '{invalid-json',
      });
      const resBadJson = await worker.fetch(reqBadJson, env, ctx);
      expect(resBadJson.status).toBe(400);
      const json = await resBadJson.json<any>();
      expect(json.error).toBe('Invalid JSON');
    });
  });
});
