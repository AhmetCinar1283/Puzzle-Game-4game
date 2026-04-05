import type { LevelData, Direction } from '../../app/src/games/types';
import { initialStateFromLevel } from '../../app/src/games/logic/gameReducer';
import { processMoveStep } from '../../app/src/games/logic/engine/tick';

const VALID_DIRECTIONS = new Set(['up', 'down', 'left', 'right']);

/**
 * Replay a move sequence on the given level and return true if the result is a win.
 * Returns false for invalid moves or if the game is lost/not won after all moves.
 */
export function verifyMoves(level: LevelData, moves: string[]): boolean {
  // Validate all directions before replaying
  for (const m of moves) {
    if (!VALID_DIRECTIONS.has(m)) return false;
  }

  let state = initialStateFromLevel(level);
  for (const dir of moves as Direction[]) {
    state = processMoveStep(state, dir);
    if (state.phase === 'won') return true;
    if (state.phase === 'lost') return false;
  }
  return false;
}
