import type {
  Direction,
  MovementMode,
  Position,
  CellType,
  LevelData,
  GameObjectState,
  GameState,
  LevelTargetDef,
  LostReason,
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

// Returns null = blocked by wall, 'lava' = death by lava edge, Position = valid destination
type EdgeResult = Position | null | 'lava';

function resolveEdgePosition(candidate: Position, level: LevelData): EdgeResult {
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

// forbidden is NOT in this list — objects can enter it (but then lose)
function isCellBlocking(cell: CellType): boolean {
  return cell === 'obstacle';
}

type MoveResult = Position | 'lava';

export function computeNewPosition(
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
  const moveResults: MoveResult[] = state.objects.map((obj) =>
    computeNewPosition(obj, direction, state.level, state.objects),
  );

  // Check if any object hit a lava edge → instant death (object stays at current pos visually)
  const hitLava = moveResults.some((r) => r === 'lava');
  if (hitLava) {
    return {
      ...state,
      phase: 'lost',
      lostReason: 'lava_edge' as LostReason,
      moveCount: state.moveCount + 1,
    };
  }

  const newPositions = moveResults as Position[];

  // Update trail only when trailCollision is enabled (no need to track otherwise)
  let newTrail = state.trail;
  if (state.level.trailCollision) {
    state.objects.forEach((obj, i) => {
      const moved =
        newPositions[i].row !== obj.position.row || newPositions[i].col !== obj.position.col;
      if (moved) {
        newTrail = addToTrail(newTrail, obj.id, obj.position);
      }
    });
  }

  // Apply moves with side-effects
  const newObjects = state.objects.map((obj, i) =>
    applyMoveToObject(obj, newPositions[i], state.level, state.level.targets),
  );

  // Check forbidden cell
  const hitForbidden = newObjects.some(
    (obj) => state.level.grid[obj.position.row][obj.position.col] === 'forbidden',
  );
  if (hitForbidden) {
    return {
      ...state,
      objects: newObjects,
      trail: newTrail,
      phase: 'lost',
      lostReason: 'forbidden' as LostReason,
      moveCount: state.moveCount + 1,
    };
  }

  // Check trail collision: landing on the opponent's trail causes a loss
  if (state.level.trailCollision) {
    const hitOpponentTrail = newObjects.some((obj) => {
      return state.objects.some((otherObj) => {
        if (otherObj.id === obj.id) return false;
        const otherTrail = newTrail[otherObj.id] ?? [];
        return otherTrail.some(
          (p) => p.row === obj.position.row && p.col === obj.position.col,
        );
      });
    });

    if (hitOpponentTrail) {
      return {
        ...state,
        objects: newObjects,
        trail: newTrail,
        phase: 'lost',
        lostReason: 'trail' as LostReason,
        moveCount: state.moveCount + 1,
      };
    }
  }

  const won = checkWinCondition(newObjects, state.level.targets);

  return {
    ...state,
    objects: newObjects,
    trail: newTrail,
    phase: won ? 'won' : 'playing',
    lostReason: undefined,
    moveCount: state.moveCount + 1,
  };
}
