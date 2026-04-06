import type { Env, CompleteLevelRequest, CompleteLevelResponse } from './types';
import { MOVES_LIMIT } from './types';
import { verifyIdToken } from './auth';
import { getAdminAccessToken } from './serviceAccount';
import { fsGet, fsCommit, parseLevelDoc, docPath, nowTimestamp, fromDoc } from './firestore';
import { verifyMoves } from './gameVerify';
import { getSolutionStats, computeStars, updateSolutions } from './solutions';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/complete-level') {
      return handleCompleteLevel(request, env, corsHeaders);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
} satisfies ExportedHandler<Env>;

async function handleCompleteLevel(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  function err(status: number, message: string): Response {
    return Response.json({ success: false, error: message }, { status, headers: corsHeaders });
  }

  // ── 1. Parse & validate request body ───────────────────────────────────────
  let body: CompleteLevelRequest;
  try {
    body = await request.json() as CompleteLevelRequest;
  } catch {
    return err(400, 'Invalid JSON');
  }

  const { levelId, moves, timeSpent } = body;
  if (!levelId || typeof levelId !== 'string') return err(400, 'Missing levelId');
  if (!Array.isArray(moves) || moves.length === 0) return err(400, 'Missing moves');
  if (moves.length > MOVES_LIMIT) return err(400, `Too many moves (max ${MOVES_LIMIT})`);
  if (typeof timeSpent !== 'number' || timeSpent < 0) return err(400, 'Invalid timeSpent');

  // ── 2. Verify Firebase ID token ─────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return err(401, 'Missing Authorization header');

  let uid: string;
  try {
    uid = await verifyIdToken(idToken, env.FIREBASE_API_KEY);
  } catch {
    return err(401, 'Invalid token');
  }

  // ── 3. Get admin access token ──────────────────────────────────────────────
  let adminToken: string;
  try {
    adminToken = await getAdminAccessToken(env.GOOGLE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error('Service account error:', e);
    return err(500, 'Internal error');
  }

  const projectId = env.FIREBASE_PROJECT_ID;

  // ── 4. Fetch level from Firestore ──────────────────────────────────────────
  const levelDoc = await fsGet(projectId, `levels/${levelId}`, adminToken);
  if (!levelDoc) return err(404, 'Level not found');

  let levelData;
  try {
    levelData = parseLevelDoc(levelDoc, levelId);
  } catch (e) {
    console.error('Level parse error:', e);
    return err(500, 'Failed to parse level');
  }

  // ── 5. Replay moves & verify win ───────────────────────────────────────────
  const isValid = verifyMoves(levelData, moves);
  if (!isValid) return err(400, 'Invalid solution');

  // ── 6. Parallel reads: existing played record + best solution move count ───
  const playedPath = `users/${uid}/playedLevels/${levelId}`;
  const [existingPlayed, solutionStats] = await Promise.all([
    fsGet(projectId, playedPath, adminToken),
    getSolutionStats(projectId, levelId, adminToken),
  ]);
  const { bestMoveCount, worstTopMoveCount, topCount } = solutionStats;

  // ── 7. Compute stars and score delta ──────────────────────────────────────
  const isFirstCompletion = existingPlayed === null;
  const existingData = existingPlayed !== null ? fromDoc(existingPlayed) : null;
  const existingStars = existingData !== null ? Number(existingData.stars ?? 0) : 0;
  const newStars = computeStars(moves.length, bestMoveCount);
  const scoreDelta = Math.max(0, newStars - existingStars);

  // Stars and moveCount stored in Firestore always reflect best-ever performance
  const bestStars = Math.max(newStars, existingStars);
  const existingMoveCount = isFirstCompletion
    ? moves.length
    : Math.min(moves.length, Number(existingData?.moveCount ?? moves.length));

  // ── 8. Batch write: score update + playedLevel upsert ─────────────────────
  const now = nowTimestamp();
  const writes: unknown[] = [];

  // User doc transforms — only when something improves
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

  // Always upsert the playedLevel record (updates timestamp + preserves best stats)
  writes.push({
    update: {
      name: docPath(projectId, playedPath),
      fields: {
        stars:      { integerValue: String(bestStars) },
        score:      { integerValue: String(bestStars) },     // mirrors stars
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
    return err(500, 'Failed to save progress');
  }

  // ── 9. Update top-3 solutions (non-fatal) ────────────────────────────────
  // bestMoveCount was read before the batch write → reflects state before this submission
  const isNewBestSolution = bestMoveCount === null || moves.length < bestMoveCount;
  const isBestSolution    = bestMoveCount !== null && moves.length === bestMoveCount;
  // "Good": makes it into top-N without tying/beating the best
  //   · worstTopMoveCount === null → fewer than TOP_N entries exist → any solution qualifies
  //   · otherwise → must be ≤ worst entry in the current top-N
  const isGoodSolution    = !isNewBestSolution && !isBestSolution && (
    worstTopMoveCount === null || moves.length <= worstTopMoveCount
  );

  try {
    await updateSolutions(projectId, levelId, uid, moves, adminToken);
  } catch (e) {
    console.error('Solutions update error:', e);
  }

  // ── 10. Respond ───────────────────────────────────────────────────────────
  const response: CompleteLevelResponse = {
    success: true,
    isFirstCompletion,
    isNewBestSolution,
    isBestSolution,
    isGoodSolution,
    stars: bestStars as 1 | 2 | 3,
    scoreDelta,
  };

  return Response.json(response, { headers: corsHeaders });
}
