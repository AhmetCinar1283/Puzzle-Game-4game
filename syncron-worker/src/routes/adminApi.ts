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
import { fsGet, fromDoc } from '../services/firestore';
import {
  queryAuditLogs,
  getAuditLogStats,
  getLastActivity,
} from '../services/auditLog';
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
