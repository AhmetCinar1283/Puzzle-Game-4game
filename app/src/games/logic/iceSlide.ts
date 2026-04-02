import type { CellType, Direction, LevelData, Position } from '../types';
import { DELTA } from './positionUtils';

type EdgeResult = Position | null | 'lava';

function resolveEdge(candidate: Position, level: LevelData): EdgeResult {
  let { row, col } = candidate;

  if (row < 0) {
    if (level.edges.top === 'portal') row = level.height - 1;
    else return null; // wall or lava → stop (not lava-death during slide)
  } else if (row >= level.height) {
    if (level.edges.bottom === 'portal') row = 0;
    else return null;
  }

  if (col < 0) {
    if (level.edges.left === 'portal') col = level.width - 1;
    else return null;
  } else if (col >= level.width) {
    if (level.edges.right === 'portal') col = 0;
    else return null;
  }

  return { row, col };
}

/**
 * Resolves the final resting position of an entity that has entered an ice cell.
 *
 * @param startPos  The first ice cell the entity landed on.
 * @param direction The direction of movement (already resolved for mode).
 * @param grid      Level grid.
 * @param level     Level data (for edge behavior).
 * @param isBlocking Callback — returns true if the given position is impassable.
 *
 * @returns finalPos: where the entity ends up.
 *          intermediates: all ice cells traversed before finalPos.
 *
 * Note: lava edges during slide are treated as walls (stop at last valid ice cell).
 * Only the first step of movement triggers lava death; mid-slide lava edges are safe stops.
 */
export function resolveIceSlide(
  startPos: Position,
  direction: Direction,
  grid: CellType[][],
  level: LevelData,
  isBlocking: (pos: Position) => boolean,
): { finalPos: Position; intermediates: Position[] } {
  const { dRow, dCol } = DELTA[direction];
  const intermediates: Position[] = [];
  let current = startPos;

  for (let i = 0; i < level.width * level.height; i++) {
    const candidate: Position = { row: current.row + dRow, col: current.col + dCol };
    const resolved = resolveEdge(candidate, level);

    // Edge blocked (wall or lava boundary) → stop at current
    if (!resolved || resolved === 'lava') break;

    // Blocking cell (obstacle) → stop at current
    if (isBlocking(resolved)) break;

    const nextCell = grid[resolved.row][resolved.col];

    if (nextCell === 'ice') {
      // Continue sliding through this ice cell
      intermediates.push(current);
      current = resolved;
    } else {
      // First non-ice walkable cell → stop here
      intermediates.push(current);
      current = resolved;
      break;
    }
  }

  return { finalPos: current, intermediates };
}
