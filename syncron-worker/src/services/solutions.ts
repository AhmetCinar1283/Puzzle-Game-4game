import { fsGet, fsSet, fromDoc } from './firestore';
import type { StarCount } from '../types';

const TOP_N = 3;

interface SolutionEntry {
  moves: string[];
  moveCount: number;
  uid: string;
  solvedAt: number;
}

export interface SolutionStats {
  /** Shortest move count in the list; null if no solutions yet. */
  bestMoveCount: number | null;
  /**
   * Worst (longest) move count among the current top-N entries.
   * null if fewer than TOP_N solutions exist (room for any newcomer).
   */
  worstTopMoveCount: number | null;
  /** How many solutions are currently stored (0 – TOP_N). */
  topCount: number;
}

/**
 * Read solution stats for a level (best, worst-in-top, count).
 * Replaces the old getBestMoveCount — call once, use all three values.
 */
export async function getSolutionStats(
  projectId: string,
  firestoreId: string,
  accessToken: string,
): Promise<SolutionStats> {
  const path = `levels/${firestoreId}/infos/solutions`;
  const doc = await fsGet(projectId, path, accessToken);
  if (!doc) return { bestMoveCount: null, worstTopMoveCount: null, topCount: 0 };

  const existing: SolutionEntry[] =
    (fromDoc(doc).solutions as SolutionEntry[] | undefined) ?? [];
  if (existing.length === 0) return { bestMoveCount: null, worstTopMoveCount: null, topCount: 0 };

  const sorted = [...existing].sort((a, b) => a.moveCount - b.moveCount);
  return {
    bestMoveCount: sorted[0].moveCount,
    worstTopMoveCount: existing.length >= TOP_N ? sorted[sorted.length - 1].moveCount : null,
    topCount: existing.length,
  };
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
 * Update the top-N shortest solutions for a level.
 * Only writes if the new solution is strictly better than the uid's existing entry.
 */
export async function updateSolutions(
  projectId: string,
  firestoreId: string,
  uid: string,
  moves: string[],
  accessToken: string,
): Promise<void> {
  const path = `levels/${firestoreId}/infos/solutions`;
  const doc = await fsGet(projectId, path, accessToken);

  const existing: SolutionEntry[] = doc
    ? ((fromDoc(doc).solutions as SolutionEntry[] | undefined) ?? [])
    : [];

  const existingEntry = existing.find((e) => e.uid === uid);

  // Only update if this submission is strictly better (fewer moves)
  if (existingEntry && moves.length >= existingEntry.moveCount) return;

  const newEntry: SolutionEntry = {
    moves,
    moveCount: moves.length,
    uid,
    solvedAt: Date.now(),
  };

  // Replace this uid's old entry with the new (better) one; keep top-N shortest
  const withoutThisUid = existing.filter((e) => e.uid !== uid);
  const combined = [...withoutThisUid, newEntry].sort(
    (a, b) => a.moveCount - b.moveCount || a.solvedAt - b.solvedAt,
  );
  const top = combined.slice(0, TOP_N);

  await fsSet(projectId, path, { solutions: top }, accessToken);
}
