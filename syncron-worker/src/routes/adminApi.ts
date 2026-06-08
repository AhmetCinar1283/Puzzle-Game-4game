/**
 * GET /admin/users           — List users (search + filter + pagination)
 * GET /admin/users/:uid      — Single user profile
 * GET /admin/users/:uid/logs — User's audit logs (filter + pagination)
 * GET /admin/users/:uid/stats — User's log statistics
 *
 * All endpoints require admin or moderator role (enforced by adminAuth middleware).
 * User data is fetched from Firestore, audit logs from D1.
 *
 * Moderators can only read. Admins can read. Neither can write user data
 * through this API (writes are reserved for the main user-facing endpoints).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../types';
import { adminAuth } from '../middleware/adminAuth';
import { getAdminAccessToken } from '../services/serviceAccount';
import { fsGet, fromDoc, fsPatch, fsDelete } from '../services/firestore';
import {
  queryAuditLogs,
  getAuditLogStats,
  getLastActivity,
  writeAuditLog,
} from '../services/auditLog';
import { checkActiveBan, getActiveBans, getBanHistory } from '../services/banService';
import type { AuditCategory, AuditAction } from '../services/auditLog';

export const adminApiRouter = new Hono<AppContext>();

// All admin routes require auth
adminApiRouter.use('/admin/*', adminAuth);

// ─── Query schemas ────────────────────────────────────────────────────────────

const AUDIT_CATEGORIES = ['game', 'support', 'account', 'payment', 'admin'] as const;

const logsQuerySchema = z.object({
  category: z.enum(AUDIT_CATEGORIES).optional(),
  action:   z.string().max(64).optional(),
  after:    z.string().datetime({ offset: true }).optional(),
  before:   z.string().datetime({ offset: true }).optional(),
  limit:    z.coerce.number().int().min(1).max(100).default(50),
  offset:   z.coerce.number().int().min(0).default(0),
});

// ─── GET /admin/users/:uid ────────────────────────────────────────────────────

adminApiRouter.get('/admin/users/:uid', async (c) => {
  const uid = c.req.param('uid');

  try {
    const adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
    const userDoc = await fsGet(c.env.FIREBASE_PROJECT_ID, `users/${uid}`, adminToken);

    if (!userDoc) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    const data = fromDoc(userDoc);

    return c.json({
      success: true,
      user: {
        uid,
        email:          data.email ?? null,
        displayName:    data.displayName ?? null,
        tag:            data.tag ?? null,
        role:           data.role ?? 'user',
        authProvider:   data.authProvider ?? 'anonymous',
        totalScore:     data.totalScore ?? 0,
        completedCount: data.completedCount ?? 0,
        createdAt:      data.createdAt ?? null,
        acceptedTermsAt: data.acceptedTermsAt ?? null,
      },
    });
  } catch (err) {
    console.error(`[AdminAPI] Failed to fetch user ${uid}:`, err);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});

// ─── GET /admin/users/:uid/logs ───────────────────────────────────────────────

adminApiRouter.get('/admin/users/:uid/logs', async (c) => {
  const uid = c.req.param('uid');

  // Validate query parameters
  const queryParsed = logsQuerySchema.safeParse(Object.fromEntries(
    new URL(c.req.url).searchParams,
  ));
  if (!queryParsed.success) {
    return c.json({ success: false, error: 'Invalid query parameters' }, 400);
  }

  const { category, action, after, before, limit, offset } = queryParsed.data;

  try {
    const logs = await queryAuditLogs(
      c.env.AUDIT_DB,
      uid,
      {
        category: category as AuditCategory | undefined,
        action:   action as AuditAction | undefined,
        after,
        before,
      },
      limit,
      offset,
    );

    return c.json({ success: true, logs, limit, offset });
  } catch (err) {
    console.error(`[AdminAPI] Failed to query logs for ${uid}:`, err);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});

// ─── GET /admin/users/:uid/stats ──────────────────────────────────────────────

adminApiRouter.get('/admin/users/:uid/stats', async (c) => {
  const uid = c.req.param('uid');

  try {
    const [stats, lastActivity] = await Promise.all([
      getAuditLogStats(c.env.AUDIT_DB, uid),
      getLastActivity(c.env.AUDIT_DB, uid),
    ]);

    return c.json({ success: true, stats, lastActivity });
  } catch (err) {
    console.error(`[AdminAPI] Failed to get stats for ${uid}:`, err);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});

// ─── GET /admin/users/:uid/played-levels ──────────────────────────────────────

adminApiRouter.get('/admin/users/:uid/played-levels', async (c) => {
  const uid = c.req.param('uid');
  const limitParam = Number(new URL(c.req.url).searchParams.get('limit') ?? '50');
  const limit = Math.min(Math.max(1, limitParam), 100);

  try {
    const adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);

    // Firestore REST — list subcollection with a page size
    const projectId = c.env.FIREBASE_PROJECT_ID;
    const basePath = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    const res = await fetch(
      `${basePath}/users/${uid}/playedLevels?pageSize=${limit}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );

    if (!res.ok) {
      throw new Error(`Firestore list failed: ${res.status}`);
    }

    const json = await res.json() as { documents?: Array<{ name: string; fields: Record<string, unknown> }> };
    const docs = json.documents ?? [];

    const playedLevels = docs.map((doc) => {
      const levelId = doc.name.split('/').pop() ?? '';
      const fields = fromDoc(doc as Parameters<typeof fromDoc>[0]);
      return {
        levelId,
        stars:       fields.stars ?? 0,
        moveCount:   fields.moveCount ?? null,
        timeSpent:   fields.timeSpent ?? null,
        completedAt: fields.completedAt ?? null,
        updatedAt:   fields.updatedAt ?? null,
      };
    });

    return c.json({ success: true, playedLevels });
  } catch (err) {
    console.error(`[AdminAPI] Failed to fetch played levels for ${uid}:`, err);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});

// ─── POST /admin/users/:uid/bans ──────────────────────────────────────────────

const createBanSchema = z.object({
  banType: z.enum(['platform', 'tag', 'social', 'coop']),
  reason: z.string().min(1).max(500),
  expiresAt: z.string().datetime({ offset: true }).optional()
    .refine((val) => !val || new Date(val) > new Date(), {
      message: 'Expiration date must be in the future',
    }),
});

adminApiRouter.post('/admin/users/:uid/bans', async (c) => {
  if (c.get('role') !== 'admin') {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }

  const uid = c.req.param('uid');
  const adminUid = c.get('uid');

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const validation = createBanSchema.safeParse(body);
  if (!validation.success) {
    const error = validation.error.errors[0]?.message || 'Invalid request';
    return c.json({ success: false, error }, 400);
  }

  const { banType, reason, expiresAt } = validation.data;
  const db = c.env.AUDIT_DB;

  try {
    // 1. Handle tag ban specific actions (Firestore)
    if (banType === 'tag') {
      let adminToken;
      try {
        adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
      } catch (e) {
        console.error('Service account error:', e);
        return c.json({ success: false, error: 'Internal error' }, 500);
      }

      const projectId = c.env.FIREBASE_PROJECT_ID;

      // Fetch user profile first to find tag
      const userDoc = await fsGet(projectId, `users/${uid}`, adminToken);
      if (userDoc) {
        const userData = fromDoc(userDoc);
        const tag = typeof userData.tag === 'string' ? userData.tag : null;

        // If user has a tag, delete it from tag registry
        if (tag) {
          try {
            await fsDelete(projectId, `tags/${tag.toUpperCase()}`, adminToken);
          } catch (delErr) {
            console.warn(`[AdminAPI] Failed to delete tag ${tag} from registry:`, delErr);
            // Non-fatal, continue to make sure we set users/{uid} tag to null
          }
        }
      }

      // Update Firestore users/{uid}: set tag to null and tagChangeCount to 999
      await fsPatch(projectId, `users/${uid}`, { tag: null, tagChangeCount: 999 }, ['tag', 'tagChangeCount'], adminToken);
    }

    // 2. Perform D1 updates
    const expiresAtStr = expiresAt || null;
    const banId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);

    if (banType === 'tag') {
      const stmt1 = db
        .prepare('UPDATE user_profiles SET tag = NULL WHERE uid = ?1')
        .bind(uid);
      const stmt2 = db
        .prepare(
          `INSERT INTO user_bans (id, uid, ban_type, reason, issued_by, expires_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
        )
        .bind(banId, uid, banType, reason, adminUid, expiresAtStr);

      await db.batch([stmt1, stmt2]);
    } else {
      await db
        .prepare(
          `INSERT INTO user_bans (id, uid, ban_type, reason, issued_by, expires_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
        )
        .bind(banId, uid, banType, reason, adminUid, expiresAtStr)
        .run();
    }

    // 3. Write Audit Log
    c.executionCtx.waitUntil(
      writeAuditLog(db, uid, 'admin.ban', 'admin', {
        banId,
        banType,
        reason,
        expiresAt: expiresAtStr,
        issuedBy: adminUid,
      }).catch((err) => console.error('[AuditLog] admin.ban write failed:', err))
    );

    return c.json({ success: true, banId });
  } catch (err) {
    console.error(`[AdminAPI] Failed to issue ban for ${uid}:`, err);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});

// ─── POST /admin/users/:uid/bans/:banId/lift ───────────────────────────────────

adminApiRouter.post('/admin/users/:uid/bans/:banId/lift', async (c) => {
  if (c.get('role') !== 'admin') {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }

  const uid = c.req.param('uid');
  const banId = c.req.param('banId');
  const adminUid = c.get('uid');
  const db = c.env.AUDIT_DB;

  try {
    // 1. Fetch ban record to check if it exists, is active, and see its type
    const ban = await db
      .prepare('SELECT ban_type FROM user_bans WHERE id = ?1 AND uid = ?2 AND lifted_at IS NULL')
      .bind(banId, uid)
      .first<{ ban_type: string }>();

    if (!ban) {
      return c.json({ success: false, error: 'Active ban record not found' }, 404);
    }

    // 2. If it's a tag ban, reset tagChangeCount in Firestore to 0
    if (ban.ban_type === 'tag') {
      let adminToken;
      try {
        adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
      } catch (e) {
        console.error('Service account error:', e);
        return c.json({ success: false, error: 'Internal error' }, 500);
      }
      const projectId = c.env.FIREBASE_PROJECT_ID;
      await fsPatch(projectId, `users/${uid}`, { tagChangeCount: 0 }, ['tagChangeCount'], adminToken);
    }

    // 3. Update DB
    const now = new Date().toISOString();
    const result = await db
      .prepare(
        `UPDATE user_bans
         SET lifted_at = ?3, lifted_by = ?4
         WHERE id = ?1 AND uid = ?2 AND lifted_at IS NULL`
      )
      .bind(banId, uid, now, adminUid)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: 'Active ban record not found' }, 404);
    }

    // 4. Write Audit Log
    c.executionCtx.waitUntil(
      writeAuditLog(db, uid, 'admin.ban_lift', 'admin', {
        banId,
        banType: ban.ban_type,
        liftedBy: adminUid,
      }).catch((err) => console.error('[AuditLog] admin.ban_lift write failed:', err))
    );

    return c.json({ success: true });
  } catch (err) {
    console.error(`[AdminAPI] Failed to lift ban ${banId} for ${uid}:`, err);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});

// ─── GET /admin/users/:uid/bans ───────────────────────────────────────────────

adminApiRouter.get('/admin/users/:uid/bans', async (c) => {
  const uid = c.req.param('uid');
  const db = c.env.AUDIT_DB;

  try {
    const [bans, activeBans] = await Promise.all([
      getBanHistory(db, uid),
      getActiveBans(db, uid),
    ]);

    return c.json({
      success: true,
      bans,
      activeBans,
    });
  } catch (err) {
    console.error(`[AdminAPI] Failed to fetch bans for ${uid}:`, err);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});

