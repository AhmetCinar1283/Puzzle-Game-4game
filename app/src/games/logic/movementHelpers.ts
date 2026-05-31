import type {
  Direction,
  MovementMode,
  Position,
  CellType,
  LevelData,
  GameObjectState,
  GameState,
  LevelTargetDef,
  BoxState,
} from '../types';
import { DELTA, posKey, posEqual } from './positionUtils';

// ─── Direction helpers ────────────────────────────────────────────────────────

export const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export function resolveDirection(pressed: Direction, mode: MovementMode): Direction {
  return mode === 'reversed' ? OPPOSITE[pressed] : pressed;
}

// ─── Edge resolution ──────────────────────────────────────────────────────────

export type EdgeResult = Position | null | 'lava';

export function resolveEdgePosition(candidate: Position, level: LevelData): EdgeResult {
  let { row, col } = candidate;

  if (row < 0) {
    if (level.edges.top === 'portal') row = level.height - 1;
    else if (level.edges.top === 'lava') return 'lava';
    else return null;
  } else if (row >= level.height) {
    if (level.edges.bottom === 'portal') row = 0;
    else if (level.edges.bottom === 'lava') return 'lava';
    else return null;
  }

  if (col < 0) {
    if (level.edges.left === 'portal') col = level.width - 1;
    else if (level.edges.left === 'lava') return 'lava';
    else return null;
  } else if (col >= level.width) {
    if (level.edges.right === 'portal') col = 0;
    else if (level.edges.right === 'lava') return 'lava';
    else return null;
  }

  return { row, col };
}

// ─── Cell blocking ────────────────────────────────────────────────────────────

export function isCellBlocking(cell: CellType): boolean {
  return cell === 'obstacle';
}

// ─── Trail helper ─────────────────────────────────────────────────────────────

export function addToTrail(
  trail: Record<number, Position[]>,
  objectId: number,
  pos: Position,
): Record<number, Position[]> {
  const existing = trail[objectId] ?? [];
  if (existing.some((p) => posEqual(p, pos))) return trail;
  return { ...trail, [objectId]: [...existing, pos] };
}

// ─── Win condition ────────────────────────────────────────────────────────────

export function checkWinCondition(
  objects: GameObjectState[],
  targets: LevelTargetDef[],
): boolean {
  return targets.every((target) => {
    const obj = objects.find((o) => o.id === target.objectId);
    if (!obj) return false;
    return posEqual(obj.position, target.position);
  });
}

// ─── Apply move side-effects ──────────────────────────────────────────────────

export function applyMoveToObject(
  obj: GameObjectState,
  newPos: Position,
  level: LevelData,
  targets: LevelTargetDef[],
): GameObjectState {
  const cellType = level.grid[newPos.row]?.[newPos.col];

  const newMode: MovementMode =
    cellType === 'direction_toggle'
      ? obj.mode === 'normal'
        ? 'reversed'
        : 'normal'
      : obj.mode;

  const target = targets.find((t) => t.objectId === obj.id);
  const onTarget =
    target !== undefined && posEqual(newPos, target.position);

  const newIsLocked = obj.isLocked || (obj.lockOnTarget && onTarget);

  return { ...obj, position: newPos, mode: newMode, isLocked: newIsLocked };
}

// ─── Ice slide blocking helper ────────────────────────────────────────────────

export function buildPlayerIsBlocking(
  level: LevelData,
  selfId: number,
  allObjects: GameObjectState[],
  allBoxes: BoxState[],
): (p: Position) => boolean {
  return (p: Position) => {
    const cell = level.grid[p.row]?.[p.col];
    if (!cell || isCellBlocking(cell)) return true;
    if (allObjects.some((o) => o.id !== selfId && posEqual(o.position, p))) return true;
    if (allBoxes.some((b) => posEqual(b.position, p))) return true;
    return false;
  };
}

// ─── Player desired position (Pass 1) ────────────────────────────────────────
// Ignores boxes (handled separately in Pass 2). Blocks on: obstacles, other players, walls.

export type MoveResult = Position | 'lava';

export function computePlayerDesiredPosition(
  obj: GameObjectState,
  direction: Direction,
  level: LevelData,
  allObjects: GameObjectState[],
): MoveResult {
  if (obj.isLocked) return obj.position;

  const actualDir = resolveDirection(direction, obj.mode);
  const { dRow, dCol } = DELTA[actualDir];

  const candidate: Position = {
    row: obj.position.row + dRow,
    col: obj.position.col + dCol,
  };

  const resolved = resolveEdgePosition(candidate, level);
  if (resolved === 'lava') return 'lava';
  if (!resolved) return obj.position;

  if (isCellBlocking(level.grid[resolved.row]?.[resolved.col] ?? 'empty')) return obj.position;

  // Other player collision (check original positions)
  if (
    allObjects.some(
      (other) => other.id !== obj.id && posEqual(other.position, resolved),
    )
  )
    return obj.position;

  return resolved;
}
