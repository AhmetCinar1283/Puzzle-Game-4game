import type { BoxState, CellType, GameObjectState, Position } from '../types';
import { isTeleporterIn, isTeleporterOut, teleporterInToOut, teleporterOutToIn, findCellPosition, posEqual } from './positionUtils';

/**
 * Shared occupancy check: teleports entity from stayPos to exitPos if exit is clear.
 */
function checkAndTeleport(
  stayPos: Position,
  exitPos: Position,
  grid: CellType[][],
  allBoxes: BoxState[],
  allObjects: GameObjectState[],
  selfId: number | null,
  selfIsBox: boolean,
): Position {
  // Check if exit cell type is blocking (obstacle)
  if (grid[exitPos.row]?.[exitPos.col] === 'obstacle') return stayPos;

  // Check if exit is occupied by a player
  const blockedByPlayer = allObjects.some(
    (o) => (selfIsBox || o.id !== selfId) && posEqual(o.position, exitPos),
  );
  if (blockedByPlayer) return stayPos;

  // Check if exit is occupied by a box (other than self if self is a box)
  const blockedByBox = allBoxes.some(
    (b) => (selfIsBox && selfId !== null ? b.id !== selfId : true) && posEqual(b.position, exitPos),
  );
  if (blockedByBox) return stayPos;

  return exitPos;
}

/**
 * Applies teleportation to an entity (player or box) at the given position.
 *
 * Forward (teleporter_in → teleporter_out):
 *   Always applies when entity is on a teleporter_in cell.
 *
 * Reverse (teleporter_out → teleporter_in):
 *   Applies only when the entity actually moved into this cell this turn.
 *   Pass prevPos (the entity's position at the start of the turn) to enable this.
 *   If prevPos equals pos (entity didn't move), reverse teleport is skipped.
 *
 * @param pos         Current position after movement resolution.
 * @param grid        Level grid.
 * @param allBoxes    Current box positions (for exit occupancy check).
 * @param allObjects  Current player positions (for exit occupancy check).
 * @param selfId      The ID of the entity being teleported (to exclude self from collision).
 * @param selfIsBox   True if the entity being teleported is a box.
 * @param prevPos     Entity's position before this move step (enables reverse teleport).
 */
export function applyEntityTeleport(
  pos: Position,
  grid: CellType[][],
  allBoxes: BoxState[],
  allObjects: GameObjectState[],
  selfId: number | null,
  selfIsBox: boolean = false,
  prevPos: Position | null = null,
): Position {
  const cell = grid[pos.row]?.[pos.col];
  if (!cell) return pos;

  // ── Forward: teleporter_in → teleporter_out ──────────────────────────────
  if (isTeleporterIn(cell)) {
    const outType = teleporterInToOut(cell);
    if (!outType) return pos;
    const exitPos = findCellPosition(grid, outType);
    if (!exitPos) return pos;
    return checkAndTeleport(pos, exitPos, grid, allBoxes, allObjects, selfId, selfIsBox);
  }

  // ── Reverse: teleporter_out → teleporter_in ──────────────────────────────
  // Only triggers if the entity actually moved into this exit cell this turn.
  if (isTeleporterOut(cell) && prevPos !== null && !posEqual(pos, prevPos)) {
    const inType = teleporterOutToIn(cell);
    if (!inType) return pos;
    const exitPos = findCellPosition(grid, inType);
    if (!exitPos) return pos;
    return checkAndTeleport(pos, exitPos, grid, allBoxes, allObjects, selfId, selfIsBox);
  }

  return pos;
}
