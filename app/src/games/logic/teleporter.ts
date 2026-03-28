import type { BoxState, CellType, GameObjectState, Position } from '../types';
import { isTeleporterIn, teleporterInToOut, findCellPosition, posEqual } from './positionUtils';

/**
 * Applies teleportation to an entity (player or box) at the given position.
 *
 * If the position is a teleporter_in_X cell:
 *   - Finds the paired teleporter_out_X position.
 *   - If the exit is clear (not blocking cell, not occupied by another player or box): teleports.
 *   - If exit is blocked: entity stays at teleporter_in cell (no teleport this turn).
 *
 * @param pos         Current position (may or may not be a teleporter_in).
 * @param grid        Level grid.
 * @param allBoxes    Current box positions (for exit occupancy check).
 * @param allObjects  Current player positions (for exit occupancy check).
 * @param selfId      The ID of the entity being teleported (to exclude self from collision).
 *                    Pass null for boxes (boxes don't have IDs in the collision sense here).
 * @param selfIsBox   True if the entity being teleported is a box.
 */
export function applyEntityTeleport(
  pos: Position,
  grid: CellType[][],
  allBoxes: BoxState[],
  allObjects: GameObjectState[],
  selfId: number | null,
  selfIsBox: boolean = false,
): Position {
  const cell = grid[pos.row]?.[pos.col];
  if (!cell || !isTeleporterIn(cell)) return pos;

  const outType = teleporterInToOut(cell);
  if (!outType) return pos;

  const exitPos = findCellPosition(grid, outType);
  if (!exitPos) return pos;

  // Check if exit cell type is blocking (obstacle)
  const exitCell = grid[exitPos.row][exitPos.col];
  if (exitCell === 'obstacle') return pos; // can't teleport to obstacle

  // Check if exit is occupied by a player
  const blockedByPlayer = allObjects.some(
    (o) => (selfIsBox || o.id !== selfId) && posEqual(o.position, exitPos),
  );
  if (blockedByPlayer) return pos;

  // Check if exit is occupied by a box (other than self if self is a box)
  const blockedByBox = allBoxes.some(
    (b) => (selfIsBox && selfId !== null ? b.id !== selfId : true) && posEqual(b.position, exitPos),
  );
  if (blockedByBox) return pos;

  return exitPos;
}
