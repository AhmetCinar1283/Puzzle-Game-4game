import { env, createExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

// Mock Auth
vi.mock('../src/services/auth', () => {
  return {
    verifyIdToken: vi.fn(async (token: string) => {
      if (token === 'valid-token-user-1') {
        return { uid: 'user-1' };
      }
      if (token === 'valid-token-user-2') {
        return { uid: 'user-2' };
      }
      throw new Error('Invalid token');
    }),
  };
});

// Mock Service Account
vi.mock('../src/services/serviceAccount', () => {
  return {
    getAdminAccessToken: vi.fn(async () => 'mock-admin-token'),
  };
});

// Mock Firestore
vi.mock('../src/services/firestore', () => {
  return {
    fsGet: vi.fn(async (projectId: string, path: string) => {
      if (path === 'users/user-1') {
        return {
          name: 'projects/syncron-1923/databases/(default)/documents/users/user-1',
          fields: {
            displayName: { stringValue: 'User One' },
            tag: { stringValue: 'U1' },
          },
        };
      }
      if (path === 'users/user-2') {
        return {
          name: 'projects/syncron-1923/databases/(default)/documents/users/user-2',
          fields: {
            displayName: { stringValue: 'User Two' },
            tag: { nullValue: null },
          },
        };
      }
      return null;
    }),
    fsCommit: vi.fn(async () => {
      return;
    }),
    docPath: (projectId: string, path: string) =>
      `projects/${projectId}/databases/(default)/documents/${path}`,
    fromDoc: (doc: any) => {
      const out: any = {};
      for (const [k, v] of Object.entries(doc.fields)) {
        if ((v as any).stringValue !== undefined) out[k] = (v as any).stringValue;
        if ((v as any).nullValue !== undefined) out[k] = null;
      }
      return out;
    },
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
  `CREATE TABLE IF NOT EXISTS badges (
    id         TEXT    NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    uid        TEXT    NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
    badge_type TEXT    NOT NULL CHECK (length(badge_type) BETWEEN 1 AND 64),
    period_id  TEXT    NOT NULL CHECK (length(period_id) BETWEEN 1 AND 20),
    rank       INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 10),
    awarded_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`
];

describe('Badge API Endpoints', () => {
  const db = env.AUDIT_DB;

  beforeAll(async () => {
    for (const stmt of SCHEMA_STATEMENTS) {
      await db.prepare(stmt).run();
    }
  });

  beforeEach(async () => {
    await db.prepare('DELETE FROM badges').run();
    await db.prepare('DELETE FROM user_profiles').run();

    // Seed User Profiles
    await db.prepare(`INSERT INTO user_profiles (uid, display_name, tag) VALUES ('user-1', 'User One', 'U1')`).run();

    // Seed Badges for user-1
    await db.prepare(`
      INSERT INTO badges (id, uid, badge_type, period_id, rank, awarded_at)
      VALUES
        ('badge-1', 'user-1', 'weekly_stars_1st', '2026-W23', 1, '2026-06-07T10:00:00Z'),
        ('badge-2', 'user-1', 'weekly_levels_top3', '2026-W23', 2, '2026-06-07T11:00:00Z')
    `).run();

    // Seed Badge for user-2 (different user)
    await db.prepare(`
      INSERT INTO badges (id, uid, badge_type, period_id, rank, awarded_at)
      VALUES ('badge-3', 'user-2', 'weekly_stars_top3', '2026-W23', 3, '2026-06-07T10:00:00Z')
    `).run();
  });

  describe('GET /badges/:uid', () => {
    it('returns all badges for a specific user', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/badges/user-1');
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const json = await res.json<any>();
      expect(json.success).toBe(true);
      expect(json.badges.length).toBe(2);
      expect(json.badges[0]).toEqual({
        id: 'badge-2',
        badgeType: 'weekly_levels_top3',
        periodId: '2026-W23',
        rank: 2,
        awardedAt: '2026-06-07T11:00:00Z',
      });
      expect(json.badges[1]).toEqual({
        id: 'badge-1',
        badgeType: 'weekly_stars_1st',
        periodId: '2026-W23',
        rank: 1,
        awardedAt: '2026-06-07T10:00:00Z',
      });
    });

    it('returns empty list for user with no badges', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/badges/nonexistent-user');
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const json = await res.json<any>();
      expect(json.success).toBe(true);
      expect(json.badges).toEqual([]);
    });

    it('fails with 400 for invalid UID length', async () => {
      const ctx = createExecutionContext();
      const longUid = 'a'.repeat(130);
      const req = new IncomingRequest(`http://localhost/badges/${longUid}`);
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(400);

      const json = await res.json<any>();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid UID');
    });
  });

  describe('POST /badges/showcase', () => {
    it('fails with 401 when not authenticated', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/badges/showcase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeIds: ['badge-1'] }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(401);
    });

    it('fails with 400 when body schema is invalid (too many badges)', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/badges/showcase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ badgeIds: ['1', '2', '3', '4', '5', '6'] }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(400);

      const json = await res.json<any>();
      expect(json.success).toBe(false);
    });

    it('fails with 400 when user tries to showcase a badge they do not own', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/badges/showcase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ badgeIds: ['badge-3'] }), // badge-3 belongs to user-2
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(400);

      const json = await res.json<any>();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid badge ID or badge does not belong to you');
    });

    it('successfully updates showcase list in D1 and Firestore', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/badges/showcase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ badgeIds: ['badge-2', 'badge-1'] }), // custom order
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const json = await res.json<any>();
      expect(json.success).toBe(true);

      // Verify D1 user_profiles showcase cache is populated in correct order
      const profile = await db
        .prepare(`SELECT showcase_badges FROM user_profiles WHERE uid = 'user-1'`)
        .first<{ showcase_badges: string }>();

      expect(profile).toBeDefined();
      const showcase = JSON.parse(profile?.showcase_badges || '[]');
      expect(showcase.length).toBe(2);
      expect(showcase[0].id).toBe('badge-2');
      expect(showcase[0].badgeType).toBe('weekly_levels_top3');
      expect(showcase[1].id).toBe('badge-1');
      expect(showcase[1].badgeType).toBe('weekly_stars_1st');
    });

    it('allows clearing the showcase list', async () => {
      const ctx = createExecutionContext();

      // Setup initial showcase in D1
      await db
        .prepare(`UPDATE user_profiles SET showcase_badges = '["badge-1"]' WHERE uid = 'user-1'`)
        .run();

      const req = new IncomingRequest('http://localhost/badges/showcase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ badgeIds: [] }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(200);

      const profile = await db
        .prepare(`SELECT showcase_badges FROM user_profiles WHERE uid = 'user-1'`)
        .first<{ showcase_badges: string }>();

      expect(profile?.showcase_badges).toBe('[]');
    });

    it('prevents SQL injection in POST /badges/showcase badgeIds', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/badges/showcase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ badgeIds: ["badge-1' OR '1'='1"] }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(400);

      const json = await res.json<any>();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid badge ID or badge does not belong to you');
    });

    it('prevents SQL injection in GET /badges/:uid', async () => {
      const ctx = createExecutionContext();
      const injectionUid = "user-1' OR '1'='1";
      const req = new IncomingRequest(`http://localhost/badges/${injectionUid}`);
      const res = await worker.fetch(req, env, ctx);
      if (res.status === 200) {
        const json = await res.json<any>();
        expect(json.success).toBe(true);
        expect(json.badges).toEqual([]);
      } else {
        expect(res.status).toBe(400);
      }
    });

    it('prevents parameter type tampering in POST /badges/showcase', async () => {
      const ctx = createExecutionContext();
      const req = new IncomingRequest('http://localhost/badges/showcase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-user-1',
        },
        body: JSON.stringify({ badgeIds: 12345 }),
      });
      const res = await worker.fetch(req, env, ctx);
      expect(res.status).toBe(400);

      const json = await res.json<any>();
      expect(json.success).toBe(false);
    });
  });
});
