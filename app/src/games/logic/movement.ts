import type {
  Direction,
  MovementMode,
  Position,
  CellType,
  LevelData,
  GameObjectState,
  GameState,
  LevelTargetDef,
} from '../types';

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const DELTA: Record<Direction, { dRow: number; dCol: number }> = {
  up: { dRow: -1, dCol: 0 },
  down: { dRow: 1, dCol: 0 },
  left: { dRow: 0, dCol: -1 },
  right: { dRow: 0, dCol: 1 },
};

export function resolveDirection(pressed: Direction, mode: MovementMode): Direction {
  return mode === 'reversed' ? OPPOSITE[pressed] : pressed;
}

function resolveEdgePosition(candidate: Position, level: LevelData): Position | null {
  let { row, col } = candidate;

  if (row < 0) {
    if (level.edges.top === 'portal') row = level.height - 1;
    else return null;
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

// forbidden is NOT in this list — objects can enter it (but then lose)
function isCellBlocking(cell: CellType): boolean {
  return cell === 'obstacle';
}

export function computeNewPosition(
  obj: GameObjectState,
  direction: Direction,
  level: LevelData,
  allObjects: GameObjectState[],
): Position {
  if (obj.isLocked) return obj.position;

  const actualDir = resolveDirection(direction, obj.mode);
  const { dRow, dCol } = DELTA[actualDir];

  const candidate: Position = {
    row: obj.position.row + dRow,
    col: obj.position.col + dCol,
  };

  const resolved = resolveEdgePosition(candidate, level);
  if (!resolved) return obj.position;

  if (isCellBlocking(level.grid[resolved.row][resolved.col])) return obj.position;

  // Object-object collision: other objects block movement
  const blocked = allObjects.some(
    (other) =>
      other.id !== obj.id &&
      other.position.row === resolved.row &&
      other.position.col === resolved.col,
  );
  if (blocked) return obj.position;

  return resolved;
}

export function applyMoveToObject(
  obj: GameObjectState,
  newPos: Position,
  level: LevelData,
  targets: LevelTargetDef[],
): GameObjectState {
  const cellType = level.grid[newPos.row][newPos.col];

  const newMode: MovementMode =
    cellType === 'direction_toggle'
      ? obj.mode === 'normal'
        ? 'reversed'
        : 'normal'
      : obj.mode;

  const target = targets.find((t) => t.objectId === obj.id);
  const onTarget =
    target !== undefined &&
    newPos.row === target.position.row &&
    newPos.col === target.position.col;

  const newIsLocked = obj.isLocked || (obj.lockOnTarget && onTarget);

  return { ...obj, position: newPos, mode: newMode, isLocked: newIsLocked };
}

export function checkWinCondition(
  objects: GameObjectState[],
  targets: LevelTargetDef[],
): boolean {
  return targets.every((target) => {
    const obj = objects.find((o) => o.id === target.objectId);
    if (!obj) return false;
    return obj.position.row === target.position.row && obj.position.col === target.position.col;
  });
}

function addToTrail(
  trail: Record<number, Position[]>,
  objectId: number,
  pos: Position,
): Record<number, Position[]> {
  const existing = trail[objectId] ?? [];
  const alreadyIn = existing.some((p) => p.row === pos.row && p.col === pos.col);
  if (alreadyIn) return trail;
  return { ...trail, [objectId]: [...existing, pos] };
}

export function processMoveStep(state: GameState, direction: Direction): GameState {
  if (state.phase === 'won' || state.phase === 'lost') return state;

  // Compute all new positions first (order-independent)
  const newPositions = state.objects.map((obj) =>
    computeNewPosition(obj, direction, state.level, state.objects),
  );

  // Update trail: record the old position for each object that actually moved
  let newTrail = state.trail;
  state.objects.forEach((obj, i) => {
    const moved =
      newPositions[i].row !== obj.position.row || newPositions[i].col !== obj.position.col;
    if (moved) {
      newTrail = addToTrail(newTrail, obj.id, obj.position);
    }
  });

  // Apply moves with side-effects
  const newObjects = state.objects.map((obj, i) =>
    applyMoveToObject(obj, newPositions[i], state.level, state.level.targets),
  );

  // Check if any object landed on a forbidden cell → game over
  const hitForbidden = newObjects.some(
    (obj) => state.level.grid[obj.position.row][obj.position.col] === 'forbidden',
  );
  if (hitForbidden) {
    return {
      ...state,
      objects: newObjects,
      trail: newTrail,
      phase: 'lost',
      moveCount: state.moveCount + 1,
    };
  }

  const won = checkWinCondition(newObjects, state.level.targets);

  return {
    ...state,
    objects: newObjects,
    trail: newTrail,
    phase: won ? 'won' : 'playing',
    moveCount: state.moveCount + 1,
  };
}
