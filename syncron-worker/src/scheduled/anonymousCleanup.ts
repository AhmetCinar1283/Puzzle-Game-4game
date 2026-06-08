/**
 * Anonymous User Cleanup — Scheduled Cron Trigger
 *
 * Runs daily at 04:00 UTC via Cloudflare Cron Triggers.
 * Deletes D1 records for stale anonymous users — those whose `user_profiles`
 * entry has `tag IS NULL` (real users always get a tag from Cloud Functions)
 * AND whose `updated_at` is older than ANONYMOUS_RETENTION_DAYS.
 *
 * Why `tag IS NULL` as the anonymous proxy?
 *   All real (non-anonymous) users get a unique tag auto-assigned by the
 *   `onUserCreated` / `onUserUpgraded` Firebase Cloud Function within seconds
 *   of registration. Anonymous users skip that trigger, so their D1 profile
 *   (if any — created lazily on first level completion) always has tag = NULL.
 *
 * Coordination with Firebase Functions:
 *   Firebase Functions runs its own cleanup at 04:05 UTC (5 min later), which
 *   deletes the corresponding Firebase Auth accounts and Firestore documents.
 *   The two jobs are fully independent — no HTTP calls between them.
 *
 * Safety:
 *   - Uses batched DELETE to avoid D1 statement size limits.
 *   - Each table is deleted separately (D1 batch API does not cascade).
 *   - Errors per UID are caught individually to avoid aborting the whole run.
 */

import type { Env } from '../types';

const ANONYMOUS_RETENTION_DAYS = 30;
const BATCH_SIZE = 200; // UIDs per iteration to stay within D1 limits
const MAX_ITERATIONS = 500; // Safety guard to prevent infinite loops

export async function runAnonymousCleanup(env: Env): Promise<void> {
  const cutoff = new Date(Date.now() - ANONYMOUS_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  console.log(`[AnonymousCleanup] Starting. Cutoff: ${cutoff}`);

  let totalDeleted = 0;
  let iterations = 0;
  const failedUids = new Set<string>();

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const hasFailed = failedUids.size > 0;
    const query = `
      SELECT uid FROM user_profiles
      WHERE tag IS NULL AND updated_at < ?
      ${hasFailed ? `AND uid NOT IN (${Array(failedUids.size).fill('?').join(',')})` : ''}
      LIMIT ?
    `;

    const params: any[] = [cutoff];
    if (hasFailed) params.push(...Array.from(failedUids));
    params.push(BATCH_SIZE);

    const result = await env.AUDIT_DB
      .prepare(query)
      .bind(...params)
      .all<{ uid: string }>();

    const uids = result.results.map((r) => r.uid);
    if (uids.length === 0) break;

    for (const uid of uids) {
      try {
        await env.AUDIT_DB.batch([
          env.AUDIT_DB.prepare(`DELETE FROM audit_logs           WHERE uid = ?`).bind(uid),
          env.AUDIT_DB.prepare(`DELETE FROM user_period_scores   WHERE uid = ?`).bind(uid),
          env.AUDIT_DB.prepare(`DELETE FROM user_world_records   WHERE uid = ?`).bind(uid),
          env.AUDIT_DB.prepare(`DELETE FROM creator_scores       WHERE uid = ?`).bind(uid),
          env.AUDIT_DB.prepare(`DELETE FROM badges               WHERE uid = ?`).bind(uid),
          env.AUDIT_DB.prepare(`DELETE FROM friendships          WHERE user_a = ? OR user_b = ?`).bind(uid, uid),
          env.AUDIT_DB.prepare(`DELETE FROM user_bans            WHERE uid = ?`).bind(uid),
          // Delete user_profiles last (it drives the loop)
          env.AUDIT_DB.prepare(`DELETE FROM user_profiles        WHERE uid = ?`).bind(uid),
        ]);
        totalDeleted++;
      } catch (err) {
        console.error(`[AnonymousCleanup] Failed to delete uid=${uid}:`, err);
        failedUids.add(uid);
      }
    }

    console.log(`[AnonymousCleanup] Iteration ${iterations}: Processed ${uids.length} UIDs (total deleted: ${totalDeleted})`);

    if (uids.length < BATCH_SIZE) break;
  }

  console.log(`[AnonymousCleanup] Done. Total deleted: ${totalDeleted} anonymous users from D1.`);
}
