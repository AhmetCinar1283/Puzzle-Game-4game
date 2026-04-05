import { fsGet, fsSet, fromDoc } from './firestore';
import type { StarCount } from './types';

const TOP_N = 3;

interface SolutionEntry {
  moves: string[];
  moveCount: number;
  uid: string;
  solvedAt: number;
}

/**
 * Returns the best (shortest) move count across all existing solutions for a level.
 * Returns null if no solutions exist yet (first ever solver).
 */
export async function getBestMoveCount(
  projectId: string,
  firestoreId: string,
  accessToken: string,
): Promise<number | null> {
  const path = `levels/${firestoreId}/infos/solutions`;
  const doc = await fsGet(projectId, path, accessToken);
  if (!doc) return null;

  const existing: SolutionEntry[] =
    (fromDoc(doc).solutions as SolutionEntry[] | undefined) ?? [];
  if (existing.length === 0) return null;

  return Math.min(...existing.map((e) => e.moveCount));
}

/**
 * Compute the star rating for a solution.
 * - 3★: no prior solutions OR moveCount <= bestMoveCount (ties the best)
 * - 2★: moveCount <= floor(bestMoveCount * 1.2)
 * - 1★: everything else
 */
export function computeStars(moveCount: number, bestMoveCount: number | null): StarCount {
  if (bestMoveCount === null || moveCount <= bestMoveCount) return 3;
  if (moveCount <= Math.floor(bestMoveCount * 1.2)) return 2;
  return 1;
}

/**
 * Update the top-3 shortest solutions for a level.
 * Returns true if the submitted solution made it into the top-3.
 */
export async function updateSolutions(
  projectId: string,
  firestoreId: string,
  uid: string,
  moves: string[],
  accessToken: string,
): Promise<boolean> {
  const path = `levels/${firestoreId}/infos/solutions`;
  const doc = await fsGet(projectId, path, accessToken);

  const existing: SolutionEntry[] = doc
    ? ((fromDoc(doc).solutions as SolutionEntry[] | undefined) ?? [])
    : [];

  const newEntry: SolutionEntry = {
    moves,
    moveCount: moves.length,
    uid,
    solvedAt: Date.now(),
  };

  // Each uid keeps only their best result; sort by moveCount then solvedAt
  const withoutThisUid = existing.filter((e) => e.uid !== uid);
  const combined = [...withoutThisUid, newEntry].sort(
    (a, b) => a.moveCount - b.moveCount || a.solvedAt - b.solvedAt,
  );
  const top = combined.slice(0, TOP_N);
  const isInTop = top.some((e) => e.uid === uid);

  await fsSet(projectId, path, { solutions: top }, accessToken);
  return isInTop;
}
