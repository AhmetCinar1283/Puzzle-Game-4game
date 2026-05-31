/**
 * Context builder helpers — used by loop.ts and collision.ts to build the
 * enriched context objects passed to CellBehavior hooks.
 *
 * Centralised here so both files share the same logic without circular deps.
 */

import type { CellType, Direction, Position } from '../../types';
import { DELTA, posKey } from '../positionUtils';
import type {
  TickState,
  TickEntity,
  CellState,
  BehaviorContext,
  LeaveContext,
  IdleContext,
  NeighborMap,
} from './types';

// ─── buildNeighborMap ─────────────────────────────────────────────────────────
/**
 * Builds the 4-direction neighbor map for a given position.
 * Returns null for each direction that is outside the grid bounds.
 * entities[] lists TickEntities currently occupying that neighbor cell.
 */
export function buildNeighborMap(tick: TickState, pos: Position): NeighborMap {
  const dirs: Direction[] = ['up', 'down', 'left', 'right'];
  const map = {} as NeighborMap;
  for (const dir of dirs) {
    const { dRow, dCol } = DELTA[dir];
    const cell: CellState | undefined = tick.grid[pos.row + dRow]?.[pos.col + dCol];
    if (!cell) {
      map[dir] = null;
      continue;
    }
    map[dir] = {
      cell,
      entities: cell.occupantIds
        .map((id) => tick.entities.find((e) => e.id === id))
        .filter((e): e is TickEntity => e !== undefined),
    };
  }
  return map;
}

// ─── buildBehaviorCtx ─────────────────────────────────────────────────────────
/**
 * Creates the full BehaviorContext for canEnter / onEnter.
 * pusher is read automatically from entity.pushedBy.
 */
export function buildBehaviorCtx(
  entity: TickEntity,
  newPosition: Position,
  targetCell: CellState,
  cellType: CellType,
  tick: TickState,
): BehaviorContext {
  return {
    entity,
    newPosition,
    cellType,
    targetCell,
    tick,
    pusher: entity.pushedBy,
    isPowered: tick.poweredCells.has(posKey(newPosition)),
    neighbors: buildNeighborMap(tick, newPosition),
  };
}

// ─── buildLeaveCtx ────────────────────────────────────────────────────────────
/**
 * Creates a LeaveContext for onLeave.
 * Call BEFORE removeFromGrid — entity.position is still the current (from) cell.
 */
export function buildLeaveCtx(
  entity: TickEntity,
  toPosition: Position,
  tick: TickState,
): LeaveContext {
  const fromPosition = entity.position;
  const cell = tick.grid[fromPosition.row]?.[fromPosition.col]!;
  const cellType = cell.type as CellType;
  return {
    entity,
    fromPosition,
    toPosition,
    cellType,
    cell,
    tick,
    isPowered: tick.poweredCells.has(posKey(fromPosition)),
    neighbors: buildNeighborMap(tick, fromPosition),
  };
}

// ─── buildIdleCtx ─────────────────────────────────────────────────────────────
/**
 * Creates an IdleContext for onIdle.
 * entity.velocity must be null at the time of the call.
 */
export function buildIdleCtx(entity: TickEntity, tick: TickState): IdleContext {
  const position = entity.position;
  const cell = tick.grid[position.row]?.[position.col]!;
  const cellType = cell.type as CellType;
  return {
    entity,
    position,
    cellType,
    cell,
    tick,
    isPowered: tick.poweredCells.has(posKey(position)),
    neighbors: buildNeighborMap(tick, position),
  };
}
