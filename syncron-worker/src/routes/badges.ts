import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../types';
import { firebaseAuth } from '../middleware/auth';
import { getAdminAccessToken } from '../services/serviceAccount';
import { fsGet, fsCommit, docPath, fromDoc } from '../services/firestore';
import { updateUserShowcaseBadges } from '../services/leaderboard';

export const badgesRouter = new Hono<AppContext>();

const showcaseSchema = z.object({
  badgeIds: z.array(z.string()).max(5),
});

interface BadgeRow {
  id: string;
  badge_type: string;
  period_id: string;
  rank: number;
  awarded_at: string;
}

// ─── GET /badges/:uid ────────────────────────────────────────────────────────
// Public endpoint to retrieve all badges awarded to a specific user.
badgesRouter.get('/badges/:uid', async (c) => {
  const uid = c.req.param('uid');
  if (!uid || uid.length > 128) {
    return c.json({ success: false, error: 'Invalid UID' }, 400);
  }

  const db = c.env.AUDIT_DB;
  try {
    const { results } = await db
      .prepare(
        `SELECT id, badge_type AS badgeType, period_id AS periodId, rank, awarded_at AS awardedAt
         FROM badges
         WHERE uid = ?1
         ORDER BY awarded_at DESC`,
      )
      .bind(uid)
      .all<any>();

    return c.json({
      success: true,
      badges: results ?? [],
    });
  } catch (err) {
    console.error(`[BadgesAPI] Failed to fetch badges for UID ${uid}:`, err);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});

// ─── POST /badges/showcase ────────────────────────────────────────────────────
// Authenticated endpoint for users to select up to 5 badges to show off on profile.
badgesRouter.post('/badges/showcase', firebaseAuth, async (c) => {
  const uid = c.get('uid');

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const validation = showcaseSchema.safeParse(body);
  if (!validation.success) {
    const error = validation.error.errors[0]?.message || 'Invalid request';
    return c.json({ success: false, error }, 400);
  }

  const { badgeIds } = validation.data;
  const db = c.env.AUDIT_DB;

  let orderedBadges: BadgeRow[] = [];

  // If badgeIds is not empty, validate ownership
  if (badgeIds.length > 0) {
    try {
      const placeholders = badgeIds.map((_, i) => `?${i + 2}`).join(', ');
      const query = `
        SELECT id, badge_type, period_id, rank, awarded_at
        FROM badges
        WHERE uid = ?1 AND id IN (${placeholders})
      `;

      const { results } = await db.prepare(query).bind(uid, ...badgeIds).all<BadgeRow>();

      const resultsMap = new Map(results.map((r) => [r.id, r]));
      for (const id of badgeIds) {
        const badge = resultsMap.get(id);
        if (!badge) {
          return c.json(
            { success: false, error: `Invalid badge ID or badge does not belong to you: ${id}` },
            400,
          );
        }
        orderedBadges.push(badge);
      }
    } catch (err) {
      console.error('[BadgesAPI] D1 verification failed:', err);
      return c.json({ success: false, error: 'Database error' }, 500);
    }
  }

  // Retrieve admin access token to update Firestore
  let adminToken: string;
  try {
    adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error('[BadgesAPI] Failed to get admin token:', err);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }

  const projectId = c.env.FIREBASE_PROJECT_ID;

  // Fetch user profile from Firestore to preserve display_name and tag in D1 cache
  let userDoc;
  try {
    userDoc = await fsGet(projectId, `users/${uid}`, adminToken);
  } catch (err) {
    console.error(`[BadgesAPI] Failed to fetch user doc for ${uid}:`, err);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }

  if (!userDoc) {
    return c.json({ success: false, error: 'User profile not found' }, 404);
  }

  const userData = fromDoc(userDoc);
  const displayName = typeof userData.displayName === 'string' ? userData.displayName : 'Player';
  const tag = typeof userData.tag === 'string' ? userData.tag : null;

  // Prepare Firestore write with updateMask to prevent replacing the whole user document
  const writes = [
    {
      update: {
        name: docPath(projectId, `users/${uid}`),
        fields: {
          showcaseBadges: {
            arrayValue: {
              values: orderedBadges.map((b) => ({
                mapValue: {
                  fields: {
                    id: { stringValue: b.id },
                    badge_type: { stringValue: b.badge_type },
                    period_id: { stringValue: b.period_id },
                    rank: { integerValue: String(b.rank) },
                    awarded_at: { stringValue: b.awarded_at },
                  },
                },
              })),
            },
          },
        },
      },
      updateMask: {
        fieldPaths: ['showcaseBadges'],
      },
    },
  ];

  try {
    await fsCommit(projectId, writes, adminToken);
  } catch (err) {
    console.error('[BadgesAPI] Firestore update failed:', err);
    return c.json({ success: false, error: 'Failed to update showcase in Firestore' }, 500);
  }

  // Sync D1 user_profiles cache
  try {
    const formattedBadges = orderedBadges.map((b) => ({
      id: b.id,
      badgeType: b.badge_type,
      periodId: b.period_id,
      rank: b.rank,
      awardedAt: b.awarded_at,
    }));
    await updateUserShowcaseBadges(db, uid, displayName, tag, formattedBadges);
  } catch (err) {
    console.error('[BadgesAPI] D1 cache update failed:', err);
    // Do not fail the request if D1 profile cache write fails, as Firestore is primary
  }

  return c.json({ success: true });
});
