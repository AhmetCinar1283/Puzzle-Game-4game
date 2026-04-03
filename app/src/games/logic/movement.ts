import type {
  Direction,
  Position,
  LevelData,
  GameObjectState,
  GameState,
  LostReason,
  BoxState,
  MoveAnimType,
} from '../types';
import { posKey, posEqual } from './positionUtils';
import { computePoweredCells } from './powerSystem';
import { resolveIceSlide } from './iceSlide';
import { applyEntityTeleport } from './teleporter';
import { computeBoxChainPush, processConveyors } from './boxPhysics';
import {
  resolveDirection,
  addToTrail,
  checkWinCondition,
  applyMoveToObject,
  buildPlayerIsBlocking,
  computePlayerDesiredPosition,
  type MoveResult,
} from './movementHelpers';

export { resolveDirection, checkWinCondition, applyMoveToObject };
export { computePlayerDesiredPosition as computeNewPosition };

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

  const pushAttempts: { objId: number; firstBoxId: number; dir: Direction }[] = [];
  state.objects.forEach((obj, i) => {
    const desired = pass1[i];
    if (desired === 'lava' || posEqual(desired, obj.position)) return;
    const box = state.boxes.find((b) => posEqual(b.position, desired));
    if (!box) return;
    playerBoxMap.set(obj.id, box.id);
    pushAttempts.push({ objId: obj.id, firstBoxId: box.id, dir: resolveDirection(direction, obj.mode) });
  });

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
  const firstBoxCounts = new Map<number, number>();
  for (const { firstBoxId } of pushAttempts) firstBoxCounts.set(firstBoxId, (firstBoxCounts.get(firstBoxId) ?? 0) + 1);
  for (const [fid, count] of firstBoxCounts) if (count > 1) invalidFirstBoxes.add(fid);

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
    if (posEqual(pos, obj.position)) return pos;
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
  const projectedBoxes: BoxState[] = state.boxes.reduce<BoxState[]>((acc, box) => {
    const entry = boxPushMap.get(box.id);
    if (entry === 'lava') return acc;
    if (!entry || entry === 'conflict' || entry === null) { acc.push(box); return acc; }
    const pos = entry as Position;
    if (state.level.grid[pos.row]?.[pos.col] === 'forbidden') return acc;
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
    if (entry === null || entry === 'conflict') return;

    if (entry === 'lava') {
      currentBoxes = currentBoxes.filter((b) => b.id !== boxId);
      return;
    }

    const finalBoxPos = entry as Position;

    if (state.level.grid[finalBoxPos.row]?.[finalBoxPos.col] === 'forbidden') {
      currentBoxes = currentBoxes.filter((b) => b.id !== boxId);
      return;
    }

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

  // ── Step 16a: Animasyon tipi — her nesne için ─────────────────────────────
  const moveAnimTypes: Record<number, MoveAnimType> = {};
  state.objects.forEach((obj, i) => {
    if (obj.isLocked) { moveAnimTypes[obj.id] = 'normal'; return; }

    const startPos = obj.position;

    if (!posEqual(postIce[i], postTeleport[i])) {
      moveAnimTypes[obj.id] = 'teleport'; return;
    }

    if (
      Math.abs(rawPositions[i].row - startPos.row) > 1 ||
      Math.abs(rawPositions[i].col - startPos.col) > 1
    ) {
      moveAnimTypes[obj.id] = 'portal'; return;
    }

    if (
      !posEqual(rawPositions[i], postIce[i]) ||
      !posEqual(postTeleport[i], finalPositions[i])
    ) {
      moveAnimTypes[obj.id] = 'ice'; return;
    }

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
