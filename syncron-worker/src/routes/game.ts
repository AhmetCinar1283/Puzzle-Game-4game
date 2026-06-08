import { Hono } from 'hono';
import type { AppContext } from '../types';
import { completeLevelSchema } from '../schemas/game';
import { firebaseAuth } from '../middleware/auth';
import { getAdminAccessToken } from '../services/serviceAccount';
import { fsGet, fsCommit, parseLevelDoc, docPath, nowTimestamp, fromDoc } from '../services/firestore';
import { verifyMoves } from '../services/gameVerify';
import { getSolutionStats, computeStars, updateSolutions } from '../services/solutions';
import { writeAuditLog } from '../services/auditLog';
import { updateLeaderboardData } from '../services/leaderboard';
import { checkActiveBan } from '../services/banService';
import type { CompleteLevelResponse } from '../types';

export const gameRouter = new Hono<AppContext>();

gameRouter.post('/complete-level', firebaseAuth, async (c) => {
  const uid = c.get('uid');

  // Check for platform ban
  const isBanned = await checkActiveBan(c.env.AUDIT_DB, uid, 'platform');
  if (isBanned) {
    return c.json({ success: false, error: 'Account suspended' }, 403);
  }

  // 1. Parse JSON safely
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  // 2. Validate with Zod
  const validation = completeLevelSchema.safeParse(body);
  if (!validation.success) {
    const error = validation.error.errors[0]?.message || 'Invalid request';
    return c.json({ success: false, error }, 400);
  }

  const { levelId, moves, timeSpent } = validation.data;

  // 3. Get admin access token
  let adminToken: string;
  try {
    adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error('Service account error:', e);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }

  const projectId = c.env.FIREBASE_PROJECT_ID;

  // 4. Fetch level from Firestore
  const levelDoc = await fsGet(projectId, `levels/${levelId}`, adminToken);
  if (!levelDoc) {
    return c.json({ success: false, error: 'Level not found' }, 404);
  }

  let levelData;
  try {
    levelData = parseLevelDoc(levelDoc, levelId);
  } catch (e) {
    console.error('Level parse error:', e);
    return c.json({ success: false, error: 'Failed to parse level' }, 500);
  }

  // 5. Replay moves & verify win
  const isValid = verifyMoves(levelData, moves);
  if (!isValid) {
    return c.json({ success: false, error: 'Invalid solution' }, 400);
  }

  // 6. Parallel reads
  const playedPath = `users/${uid}/playedLevels/${levelId}`;
  const [existingPlayed, solutionStats, userDoc] = await Promise.all([
    fsGet(projectId, playedPath, adminToken),
    getSolutionStats(projectId, levelId, adminToken),
    fsGet(projectId, `users/${uid}`, adminToken),
  ]);
  const { bestMoveCount, worstTopMoveCount, bestHolderUid } = solutionStats;

  let displayName = 'Player';
  let tag: string | null = null;
  if (userDoc) {
    const userData = fromDoc(userDoc);
    if (typeof userData.displayName === 'string') {
      displayName = userData.displayName;
    }
    if (typeof userData.tag === 'string') {
      tag = userData.tag;
    }
  }

  const levelRaw = fromDoc(levelDoc);
  const createdBy = typeof levelRaw.createdBy === 'string' ? levelRaw.createdBy : null;

  // 7. Compute stars and score delta
  const isFirstCompletion = existingPlayed === null;
  const existingData = existingPlayed !== null ? fromDoc(existingPlayed) : null;
  const existingStars = existingData !== null ? Number(existingData.stars ?? 0) : 0;
  const newStars = computeStars(moves.length, bestMoveCount);
  const scoreDelta = Math.max(0, newStars - existingStars);

  const bestStars = Math.max(newStars, existingStars);
  const existingMoveCount = isFirstCompletion
    ? moves.length
    : Math.min(moves.length, Number(existingData?.moveCount ?? moves.length));

  // 8. Batch write: score update + playedLevel upsert
  const now = nowTimestamp();
  const writes: unknown[] = [];

  if (scoreDelta > 0 || isFirstCompletion) {
    const fieldTransforms: unknown[] = [];
    if (scoreDelta > 0) {
      fieldTransforms.push({
        fieldPath: 'totalScore',
        increment: { integerValue: String(scoreDelta) },
      });
    }
    if (isFirstCompletion) {
      fieldTransforms.push({
        fieldPath: 'completedCount',
        increment: { integerValue: '1' },
      });
    }
    if (fieldTransforms.length > 0) {
      writes.push({
        transform: {
          document: docPath(projectId, `users/${uid}`),
          fieldTransforms,
        },
      });
    }
  }

  writes.push({
    update: {
      name: docPath(projectId, playedPath),
      fields: {
        stars:      { integerValue: String(bestStars) },
        score:      { integerValue: String(bestStars) },
        moveCount:  { integerValue: String(existingMoveCount) },
        timeSpent:  { integerValue: String(Math.trunc(timeSpent)) },
        completedAt: isFirstCompletion
          ? { timestampValue: now }
          : existingPlayed!.fields.completedAt ?? { timestampValue: now },
        updatedAt: { timestampValue: now },
      },
    },
  });

  try {
    await fsCommit(projectId, writes, adminToken);
  } catch (e) {
    console.error('Commit error:', e);
    return c.json({ success: false, error: 'Failed to save progress' }, 500);
  }

  // 9. Update solutions
  const isNewBestSolution = bestMoveCount === null || moves.length < bestMoveCount;
  const isBestSolution    = bestMoveCount !== null && moves.length === bestMoveCount;
  const isGoodSolution    = !isNewBestSolution && !isBestSolution && (
    worstTopMoveCount === null || moves.length <= worstTopMoveCount
  );

  try {
    await updateSolutions(projectId, levelId, uid, moves, adminToken);
  } catch (e) {
    console.error('Solutions update error:', e);
  }

  // 10. Write audit log (non-blocking — never delays the response)
  c.executionCtx.waitUntil(
    writeAuditLog(c.env.AUDIT_DB, uid, 'level.complete', 'game', {
      levelId,
      moveCount:    moves.length,
      stars:        bestStars,
      scoreDelta,
      isFirst:      isFirstCompletion,
      isNewBest:    isNewBestSolution,
    }).catch((err) => console.error('[AuditLog] level.complete write failed:', err)),
  );

  // 11. Update leaderboard data in D1 (non-blocking)
  c.executionCtx.waitUntil(
    updateLeaderboardData(c.env.AUDIT_DB, uid, {
      scoreDelta,
      isFirstCompletion,
      displayName,
      tag,
      isNewBestSolution,
      oldBestHolderUid: bestHolderUid,
      createdBy,
      starsGained: bestStars,
    }).catch((err) => console.error('[Leaderboard] leaderboard update failed:', err)),
  );

  const response: CompleteLevelResponse = {
    success: true,
    isFirstCompletion,
    isNewBestSolution,
    isBestSolution,
    isGoodSolution,
    stars: bestStars as 1 | 2 | 3,
    scoreDelta,
  };

  return c.json(response);
});
