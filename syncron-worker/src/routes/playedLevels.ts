/**
 * Routes for user-facing played-levels sync and admin-level deletion with cascade.
 *
 * GET  /played-levels              — delta sync (returns records + deleted IDs)
 * DELETE /admin/levels/:levelId    — admin: delete level + cascade all D1 data
 */

import { Hono } from 'hono';
import type { AppContext } from '../types';
import { firebaseAuth } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import {
  getPlayedLevelsSince,
  getDeletedLevelsSince,
  getLevelDeletionImpact,
  deleteLevelRecords,
} from '../services/playedLevels';
import { writeAuditLog } from '../services/auditLog';
import { getAdminAccessToken } from '../services/serviceAccount';
import { fsDelete } from '../services/firestore';

export const playedLevelsRouter = new Hono<AppContext>();

// ─── GET /played-levels ───────────────────────────────────────────────────────
//
// Delta sync endpoint. Returns:
//   • records[]      — played_levels rows updated after `since` (or ALL if first sync)
//   • deletedLevelIds[] — level IDs deleted after `since` (tombstones for Dexie cleanup)
//   • serverTime     — ISO timestamp to use as the next `since` cursor
//
// Query param:
//   ?since=2026-06-16T10:00:00.000Z   (omit for full sync)

playedLevelsRouter.get('/played-levels', firebaseAuth, async (c) => {
  const uid = c.get('uid');
  const sinceRaw = new URL(c.req.url).searchParams.get('since');

  // Validate `since` if provided
  let since: string | null = null;
  if (sinceRaw) {
    const d = new Date(sinceRaw);
    if (isNaN(d.getTime())) {
      return c.json({ success: false, error: 'Invalid since parameter' }, 400);
    }
    since = sinceRaw;
  }

  try {
    const [records, deletedLevelIds] = await Promise.all([
      getPlayedLevelsSince(c.env.AUDIT_DB, uid, since),
      getDeletedLevelsSince(c.env.AUDIT_DB, since),
    ]);

    const serverTime = new Date().toISOString();

    return c.json({
      success: true,
      records: records.map((r) => ({
        levelId:     r.level_id,
        stars:       r.stars,
        score:       r.score,
        moveCount:   r.move_count,
        timeSpent:   r.time_spent,
        completedAt: r.completed_at,
        updatedAt:   r.updated_at,
      })),
      deletedLevelIds,
      serverTime,
    });
  } catch (err) {
    console.error('[PlayedLevels] GET /played-levels error:', err);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});

// ─── DELETE /admin/levels/:levelId ───────────────────────────────────────────
//
// Admin-only: permanently deletes a level and cascades all related D1 data:
//
//   1. Read played_levels impact (who completed it, how many stars each earned)
//   2. Roll back user_period_scores (stars_gained -X, levels_done -1) for each affected user
//   3. Roll back creator_scores if the level had a createdBy field
//   4. Roll back user_world_records all_time count for the world record holder
//   5. Delete all played_levels rows for this level
//   6. Insert into deleted_levels (tombstone for client delta sync)
//   7. Delete the level from Firestore (levels/{levelId} + infos/solutions subcollection)
//   8. Write admin audit log

playedLevelsRouter.delete('/admin/levels/:levelId', adminAuth, async (c) => {
  if (c.get('role') !== 'admin') {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }

  const levelId = c.req.param('levelId');
  const adminUid = c.get('uid');
  const db = c.env.AUDIT_DB;

  try {
    // ── Idempotency guard: already deleted? ──────────────────────────────────
    const alreadyDeleted = await db
      .prepare(`SELECT 1 FROM deleted_levels WHERE level_id = ?1`)
      .bind(levelId)
      .first();
    if (alreadyDeleted) {
      return c.json({ success: false, error: 'Level already deleted' }, 409);
    }

    // ── Step 1: Read impact BEFORE deletion ──────────────────────────────────
    const impact = await getLevelDeletionImpact(db, levelId);
    const { affectedUsers, worldRecordHolderUid } = impact;

    // ── Step 2: Read creator info from Firestore BEFORE deleting the doc ─────
    let createdBy: string | null = null;
    let adminToken: string;
    try {
      adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
      const { fsGet, fromDoc } = await import('../services/firestore');
      const levelDoc = await fsGet(c.env.FIREBASE_PROJECT_ID, `levels/${levelId}`, adminToken);
      if (levelDoc) {
        const levelData = fromDoc(levelDoc);
        createdBy = typeof levelData.createdBy === 'string' ? levelData.createdBy : null;
      }
    } catch (e) {
      console.warn('[LevelDelete] Could not read level createdBy from Firestore:', e);
      adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
    }

    // ── Step 3: Build D1 rollback statements ─────────────────────────────────
    const rollbackStatements: D1PreparedStatement[] = [];

    // period_types and period_ids are historical — we decrement ALL periods that
    // ever existed for each user (stars_gained and levels_done).
    // Because user_period_scores may have rows from multiple periods, we target
    // them all with a single UPDATE per uid (subtract across all rows).
    for (const { uid, stars } of affectedUsers) {
      // Decrement stars from all periods for this user
      rollbackStatements.push(
        db
          .prepare(
            `UPDATE user_period_scores
             SET stars_gained = MAX(0, stars_gained - ?2),
                 levels_done  = MAX(0, levels_done - 1),
                 updated_at   = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE uid = ?1`,
          )
          .bind(uid, stars),
      );
    }

    // World record rollback: decrement all_time count for the record holder
    if (worldRecordHolderUid) {
      rollbackStatements.push(
        db
          .prepare(
            `UPDATE user_world_records
             SET records_count = MAX(0, records_count - 1),
                 updated_at    = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE uid = ?1 AND period_type = 'all_time' AND period_id = 'all_time'`,
          )
          .bind(worldRecordHolderUid),
      );
    }

    // Creator score rollback: remove all plays + stars earned FROM this level
    if (createdBy) {
      // Sum of stars earned by all completers (what was added to creator_scores)
      const totalStarsEarned = affectedUsers.reduce((sum, u) => sum + u.stars, 0);
      const totalPlays = affectedUsers.length;

      rollbackStatements.push(
        db
          .prepare(
            `UPDATE creator_scores
             SET plays_gained = MAX(0, plays_gained - ?2),
                 stars_gained = MAX(0, stars_gained - ?3),
                 updated_at   = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE uid = ?1`,
          )
          .bind(createdBy, totalPlays, totalStarsEarned),
      );
    }

    // ── Step 4: Execute rollbacks + delete played_levels + insert tombstone ──
    if (rollbackStatements.length > 0) {
      await db.batch(rollbackStatements);
    }

    // This also inserts the deleted_levels tombstone in one batch
    await deleteLevelRecords(db, levelId);

    // ── Step 5: Delete from Firestore ────────────────────────────────────────
    try {
      // Delete the solutions subcollection doc first (child before parent)
      await fsDelete(
        c.env.FIREBASE_PROJECT_ID,
        `levels/${levelId}/infos/solutions`,
        adminToken!,
      );
    } catch {
      // Non-fatal if solutions doc doesn't exist
    }
    try {
      await fsDelete(c.env.FIREBASE_PROJECT_ID, `levels/${levelId}`, adminToken!);
    } catch (e) {
      console.warn('[LevelDelete] Firestore level doc delete failed (non-fatal):', e);
      // Non-fatal: D1 data is the canonical store. Firestore can be cleaned manually.
    }

    // ── Step 6: Audit log ────────────────────────────────────────────────────
    c.executionCtx.waitUntil(
      writeAuditLog(db, adminUid, 'admin.level_delete', 'admin', {
        levelId,
        affectedUserCount: affectedUsers.length,
        createdBy,
        worldRecordHolderUid,
      }).catch((err) => console.error('[AuditLog] admin.level_delete write failed:', err)),
    );

    return c.json({
      success: true,
      affectedUserCount: affectedUsers.length,
    });
  } catch (err) {
    console.error('[LevelDelete] Cascade delete error:', err);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});
