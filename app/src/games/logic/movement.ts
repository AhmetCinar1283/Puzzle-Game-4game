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
  BoxState,
  MoveAnimType,
} from '../types';
import { DELTA, posKey, posEqual } from './positionUtils';
import { computePoweredCells } from './powerSystem';
import { resolveIceSlide } from './iceSlide';
import { applyEntityTeleport } from './teleporter';
import { computeBoxChainPush, processConveyors } from './boxPhysics';

// ─── Direction helpers ────────────────────────────────────────────────────────

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export function resolveDirection(pressed: Direction, mode: MovementMode): Direction {
  return mode === 'reversed' ? OPPOSITE[pressed] : pressed;
}

// ─── Edge resolution ──────────────────────────────────────────────────────────

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

// ─── Cell blocking ────────────────────────────────────────────────────────────

function isCellBlocking(cell: CellType): boolean {
  return cell === 'obstacle';
}

// ─── Trail helper ─────────────────────────────────────────────────────────────

function addToTrail(
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

// ─── Ice slide helper ─────────────────────────────────────────────────────────

function buildPlayerIsBlocking(
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

type MoveResult = Position | 'lava';

function computePlayerDesiredPosition(
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

// ─── Main move pipeline ───────────────────────────────────────────────────────

export function processMoveStep(state: GameState, direction: Direction): GameState {
  if (state.phase === 'won' || state.phase === 'lost') return state;

  // ── Step 1: Compute powered cells ─────────────────────────────────────────
  const poweredCells = computePoweredCells(
    state.level.grid,
    state.level,
    state.poweredPlayers,
    state.trail,
    state.boxes,
  );

  // ── Step 2 (Pass 1): Compute raw desired positions (ignoring boxes) ────────
  const pass1: MoveResult[] = state.objects.map((obj) =>
    computePlayerDesiredPosition(obj, direction, state.level, state.objects),
  );

  // ── Step 3 (Pass 2): Resolve box pushes (with chain push support) ───────────
  type BoxPushEntry = Position | 'lava' | 'conflict' | null;
  const boxPushMap = new Map<number, BoxPushEntry>();
  const playerBoxMap = new Map<number, number>(); // playerId → first box directly pushed

  // Collect push attempts
  const pushAttempts: { objId: number; firstBoxId: number; dir: Direction }[] = [];
  state.objects.forEach((obj, i) => {
    const desired = pass1[i];
    if (desired === 'lava' || posEqual(desired, obj.position)) return;
    const box = state.boxes.find((b) => posEqual(b.position, desired));
    if (!box) return;
    playerBoxMap.set(obj.id, box.id);
    pushAttempts.push({ objId: obj.id, firstBoxId: box.id, dir: resolveDirection(direction, obj.mode) });
  });

  // Compute chain results per unique first box
  const chainResults = new Map<number, Map<number, Position> | 'lava' | null>();
  for (const { firstBoxId, dir } of pushAttempts) {
    if (chainResults.has(firstBoxId)) continue;
    const box = state.boxes.find((b) => b.id === firstBoxId)!;
    chainResults.set(firstBoxId, computeBoxChainPush(
      box, dir, state.level.grid, state.level, poweredCells, state.boxes, state.objects, new Set(),
    ));
  }

  // Detect conflicts: any box ID claimed by two different chains OR by two players directly
  const boxToFirstBoxes = new Map<number, Set<number>>();
  for (const [firstBoxId, result] of chainResults) {
    const ids: number[] = (!result || result === 'lava') ? [firstBoxId] : [...result.keys()];
    for (const bid of ids) {
      if (!boxToFirstBoxes.has(bid)) boxToFirstBoxes.set(bid, new Set());
      boxToFirstBoxes.get(bid)!.add(firstBoxId);
    }
  }
  const invalidFirstBoxes = new Set<number>();
  for (const firstBoxSet of boxToFirstBoxes.values()) {
    if (firstBoxSet.size > 1) for (const fid of firstBoxSet) invalidFirstBoxes.add(fid);
  }
  // Same first box pushed by two players
  const firstBoxCounts = new Map<number, number>();
  for (const { firstBoxId } of pushAttempts) firstBoxCounts.set(firstBoxId, (firstBoxCounts.get(firstBoxId) ?? 0) + 1);
  for (const [fid, count] of firstBoxCounts) if (count > 1) invalidFirstBoxes.add(fid);

  // Build boxPushMap
  for (const [firstBoxId, result] of chainResults) {
    if (invalidFirstBoxes.has(firstBoxId)) {
      boxPushMap.set(firstBoxId, 'conflict');
      continue;
    }
    if (!result) {
      boxPushMap.set(firstBoxId, null);
    } else if (result === 'lava') {
      boxPushMap.set(firstBoxId, 'lava');
    } else {
      for (const [boxId, pos] of result) boxPushMap.set(boxId, pos);
    }
  }

  // ── Step 4 (Pass 3): Finalize player positions ────────────────────────────
  const finalRaw: MoveResult[] = state.objects.map((obj, i) => {
    const desired = pass1[i];
    if (desired === 'lava') return 'lava';

    const boxId = playerBoxMap.get(obj.id);
    if (boxId !== undefined) {
      const entry = boxPushMap.get(boxId);
      if (entry === null || entry === 'conflict') {
        return obj.position; // push failed → player stays
      }
      // 'lava' or Position → player moves to where the box was (desired)
    }
    return desired;
  });

  // ── Step 5: Check lava for players ────────────────────────────────────────
  const hitLava = finalRaw.some((r) => r === 'lava');
  if (hitLava) {
    return {
      ...state,
      phase: 'lost',
      lostReason: 'lava_edge' as LostReason,
      moveCount: state.moveCount + 1,
    };
  }
  const rawPositions = finalRaw as Position[];

  // ── Step 6: Ice slides for players ────────────────────────────────────────
  const postIce: Position[] = rawPositions.map((pos, i) => {
    const obj = state.objects[i];
    if (posEqual(pos, obj.position)) return pos; // didn't move
    if (state.level.grid[pos.row]?.[pos.col] !== 'ice') return pos;

    const actualDir = resolveDirection(direction, obj.mode);
    const { finalPos } = resolveIceSlide(
      pos,
      actualDir,
      state.level.grid,
      state.level,
      buildPlayerIsBlocking(state.level, obj.id, state.objects, state.boxes),
    );
    return finalPos;
  });

  // ── Step 7: Teleport players ──────────────────────────────────────────────
  // Use projected box positions (post-push) for exit occupancy check so a box
  // pushed to an exit this turn blocks the player from also teleporting there.
  const projectedBoxes: BoxState[] = state.boxes.reduce<BoxState[]>((acc, box) => {
    const entry = boxPushMap.get(box.id);
    if (entry === 'lava') return acc; // will be destroyed
    if (!entry || entry === 'conflict' || entry === null) { acc.push(box); return acc; }
    const pos = entry as Position;
    if (state.level.grid[pos.row]?.[pos.col] === 'forbidden') return acc; // will be destroyed
    acc.push({ ...box, position: pos });
    return acc;
  }, []);

  const tentativeTeleport: Position[] = postIce.map((pos, i) =>
    applyEntityTeleport(
      pos, state.level.grid, projectedBoxes, state.objects, state.objects[i].id,
      false, state.objects[i].position,
    ),
  );

  // Same-exit guard: if two players teleport to the same exit, both stay at teleporter_in
  const exitCount = new Map<string, number>();
  tentativeTeleport.forEach((pos, i) => {
    if (!posEqual(pos, postIce[i])) exitCount.set(posKey(pos), (exitCount.get(posKey(pos)) ?? 0) + 1);
  });
  const postTeleport: Position[] = tentativeTeleport.map((pos, i) =>
    !posEqual(pos, postIce[i]) && (exitCount.get(posKey(pos)) ?? 0) > 1 ? postIce[i] : pos,
  );

  // ── Step 8: Post-teleport ice slide ───────────────────────────────────────
  const finalPositions: Position[] = postTeleport.map((pos, i) => {
    const obj = state.objects[i];
    if (state.level.grid[pos.row]?.[pos.col] !== 'ice') return pos;

    const actualDir = resolveDirection(direction, obj.mode);
    const { finalPos } = resolveIceSlide(
      pos,
      actualDir,
      state.level.grid,
      state.level,
      buildPlayerIsBlocking(state.level, obj.id, state.objects, state.boxes),
    );
    return finalPos;
  });

  // ── Step 9: Update trails ─────────────────────────────────────────────────
  let newTrail = state.trail;
  state.objects.forEach((obj, i) => {
    const moved = !posEqual(finalPositions[i], obj.position);
    if (moved && (state.level.trailCollision || state.poweredPlayers.includes(obj.id))) {
      newTrail = addToTrail(newTrail, obj.id, obj.position);
    }
  });

  // ── Step 10: Apply player side-effects ────────────────────────────────────
  let newPoweredPlayers = [...state.poweredPlayers];
  const newObjects = state.objects.map((obj, i) => {
    const pos = finalPositions[i];
    // Track power_node activation
    if (
      state.level.grid[pos.row]?.[pos.col] === 'power_node' &&
      !newPoweredPlayers.includes(obj.id)
    ) {
      newPoweredPlayers = [...newPoweredPlayers, obj.id];
    }
    return applyMoveToObject(obj, pos, state.level, state.level.targets);
  });

  // ── Step 11: Apply box pushes ─────────────────────────────────────────────
  let currentBoxes = [...state.boxes];

  boxPushMap.forEach((entry, boxId) => {
    if (entry === null || entry === 'conflict') return; // push failed or conflicted

    if (entry === 'lava') {
      // Box pushed off lava edge → destroy
      currentBoxes = currentBoxes.filter((b) => b.id !== boxId);
      return;
    }

    const finalBoxPos = entry; // Position

    // Box lands on forbidden → destroy silently
    if (state.level.grid[finalBoxPos.row]?.[finalBoxPos.col] === 'forbidden') {
      currentBoxes = currentBoxes.filter((b) => b.id !== boxId);
      return;
    }

    // Update box position
    currentBoxes = currentBoxes.map((b) =>
      b.id === boxId ? { ...b, position: finalBoxPos } : b,
    );
  });

  // ── Step 12: Conveyor phase ───────────────────────────────────────────────
  const conveyorResult = processConveyors(
    currentBoxes,
    newObjects,
    state.level.grid,
    state.level,
    poweredCells,
  );
  currentBoxes = conveyorResult.newBoxes;
  const postConveyorObjects = conveyorResult.newObjects;

  // ── Step 13: Check forbidden for players ─────────────────────────────────
  const hitForbidden = postConveyorObjects.some(
    (obj) => state.level.grid[obj.position.row]?.[obj.position.col] === 'forbidden',
  );
  if (hitForbidden) {
    return {
      ...state,
      objects: postConveyorObjects,
      boxes: currentBoxes,
      poweredPlayers: newPoweredPlayers,
      trail: newTrail,
      phase: 'lost',
      lostReason: 'forbidden' as LostReason,
      moveCount: state.moveCount + 1,
    };
  }

  // ── Step 14: Check trail collision ────────────────────────────────────────
  if (state.level.trailCollision) {
    const hitOpponentTrail = postConveyorObjects.some((obj) =>
      state.objects.some((otherObj) => {
        if (otherObj.id === obj.id) return false;
        const otherTrail = newTrail[otherObj.id] ?? [];
        return otherTrail.some((p) => posEqual(p, obj.position));
      }),
    );

    if (hitOpponentTrail) {
      return {
        ...state,
        objects: postConveyorObjects,
        boxes: currentBoxes,
        poweredPlayers: newPoweredPlayers,
        trail: newTrail,
        phase: 'lost',
        lostReason: 'trail' as LostReason,
        moveCount: state.moveCount + 1,
      };
    }
  }

  // ── Step 15: Check win condition ──────────────────────────────────────────
  const won = checkWinCondition(postConveyorObjects, state.level.targets);

  // ── Step 16a: Her nesne için animasyon tipi ───────────────────────────────
  const moveAnimTypes: Record<number, MoveAnimType> = {};
  state.objects.forEach((obj, i) => {
    if (obj.isLocked) { moveAnimTypes[obj.id] = 'normal'; return; }

    const startPos = obj.position;

    // Teleport: postIce → postTeleport değişti
    if (!posEqual(postIce[i], postTeleport[i])) {
      moveAnimTypes[obj.id] = 'teleport'; return;
    }

    // Portal: Pass1'de 1'den fazla hücre atladı (edge-wrap)
    if (
      Math.abs(rawPositions[i].row - startPos.row) > 1 ||
      Math.abs(rawPositions[i].col - startPos.col) > 1
    ) {
      moveAnimTypes[obj.id] = 'portal'; return;
    }

    // Ice: rawPositions → postIce VEYA postTeleport → finalPositions değişti
    if (
      !posEqual(rawPositions[i], postIce[i]) ||
      !posEqual(postTeleport[i], finalPositions[i])
    ) {
      moveAnimTypes[obj.id] = 'ice'; return;
    }

    // Conveyor: finalPositions → postConveyorObjects değişti
    if (!posEqual(finalPositions[i], postConveyorObjects[i].position)) {
      moveAnimTypes[obj.id] = 'conveyor'; return;
    }

    moveAnimTypes[obj.id] = 'normal';
  });

  // ── Step 16: Assemble new state ───────────────────────────────────────────
  return {
    ...state,
    objects: postConveyorObjects,
    boxes: currentBoxes,
    poweredPlayers: newPoweredPlayers,
    trail: newTrail,
    phase: won ? 'won' : 'playing',
    lostReason: undefined,
    moveCount: state.moveCount + 1,
    moveAnimTypes,
  };
}

// Keep old export for any external references
export { computePlayerDesiredPosition as computeNewPosition };
