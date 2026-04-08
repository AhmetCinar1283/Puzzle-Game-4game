import type {
  GameState,
  Direction,
  Position,
  CellType,
  MoveAnimType,
} from '../../types';
import type { TickState, TickEntity, Velocity, BehaviorResult } from './types';
import { computePoweredCells } from '../powerSystem';
import {
  posKey,
  posEqual,
  DELTA,
  cellTypeToConveyorDir,
} from '../positionUtils';
import {
  resolveEdgePosition,
  resolveDirection,
  addToTrail,
  checkWinCondition,
} from '../movementHelpers';
import { isConveyorActive } from '../powerSystem';
import { pushChainImmediately } from './collision';
import { CELL_BEHAVIORS } from '../behaviors/registry';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_TICK = 64;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function entityKey(e: TickEntity): string {
  return `${e.kind}:${e.id}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function processMoveStep(state: GameState, direction: Direction): GameState {
  if (state.phase === 'won' || state.phase === 'lost') return state;

  // 1. Build internal tick state from public GameState
  const tick = initTickState(state);

  // 2. Resolve dependency order for the initial player moves
  const sortedPlayerIds = resolvePlayerOrder(tick, direction);

  // 3. Assign initial velocities (may short-circuit on immediate lava death)
  assignInitialVelocities(tick, sortedPlayerIds, direction);

  // 4. Run the iterative tick loop
  if (!tick.lostReason) {
    runTickLoop(tick, sortedPlayerIds);
  }

  // 5. Project back to public GameState
  return finalizeTickState(tick, state);
}

// ─── Phase 1: Init ────────────────────────────────────────────────────────────

function initTickState(state: GameState): TickState {
  const poweredCells = computePoweredCells(
    state.level.grid,
    state.level,
    state.poweredPlayers,
    state.trail,
    state.boxes,
  );

  const entities: TickEntity[] = [
    ...state.objects.map(
      (obj): TickEntity => ({
        kind: 'player',
        id: obj.id,
        position: { ...obj.position },
        velocity: null,
        mode: obj.mode,
        lockOnTarget: obj.lockOnTarget,
        isLocked: obj.isLocked,
      }),
    ),
    ...state.boxes.map(
      (box): TickEntity => ({
        kind: 'box',
        id: box.id,
        position: { ...box.position },
        velocity: null,
        requiresPower: box.requiresPower,
      }),
    ),
  ];

  const animationPaths: Record<string, Position[]> = {};
  for (const e of entities) {
    animationPaths[entityKey(e)] = [{ ...e.position }];
  }

  return {
    level: state.level,
    grid: state.level.grid,
    poweredCells,
    entities,
    trail: { ...state.trail },
    poweredPlayers: [...state.poweredPlayers],
    animationPaths,
    didWin: false,
  };
}

// ─── Phase 2: Dependency Resolution ──────────────────────────────────────────

/**
 * Returns player IDs in the order they should receive initial velocities.
 *
 * If player A wants to move to player B's current cell AND B is also moving
 * away, A depends on B — B must be processed first. Kahn's topological sort
 * resolves the correct order. Head-on swaps (A→B and B→A simultaneously)
 * are detected first and cleared: neither player moves.
 */
function resolvePlayerOrder(tick: TickState, direction: Direction): number[] {
  const players = tick.entities.filter((e) => e.kind === 'player');

  // Compute desired destination for each non-locked player
  const desired = new Map<number, Position | null>();
  for (const p of players) {
    if (p.isLocked) { desired.set(p.id, null); continue; }
    const actualDir = resolveDirection(direction, p.mode!);
    const { dRow, dCol } = DELTA[actualDir];
    const candidate = {
      row: p.position.row + dRow,
      col: p.position.col + dCol,
    };
    const resolved = resolveEdgePosition(candidate, tick.level);
    desired.set(
      p.id,
      resolved === null || resolved === 'lava' ? null : (resolved as Position),
    );
  }

  // Detect head-on swaps → both stop
  const blockedBySwap = new Set<number>();
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i], b = players[j];
      const da = desired.get(a.id), db = desired.get(b.id);
      if (da && db && posEqual(da, b.position) && posEqual(db, a.position)) {
        blockedBySwap.add(a.id);
        blockedBySwap.add(b.id);
      }
    }
  }
  for (const id of blockedBySwap) desired.set(id, null);

  // Build dependency graph: A depends on B if A wants B's current cell and B moves
  const deps = new Map<number, Set<number>>();
  for (const a of players) {
    deps.set(a.id, new Set());
    const da = desired.get(a.id);
    if (!da) continue;
    for (const b of players) {
      if (a.id === b.id) continue;
      if (posEqual(da, b.position) && desired.get(b.id) !== null) {
        deps.get(a.id)!.add(b.id);
      }
    }
  }

  // Kahn's topological sort
  // inDegree[A] = number of prerequisites A has = deps.get(A).size
  const ids = players.map((p) => p.id);
  const inDegree = new Map<number, number>();
  for (const [nodeId, depSet] of deps) {
    inDegree.set(nodeId, depSet.size);
  }

  const queue = ids.filter((id) => inDegree.get(id) === 0);
  const result: number[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    for (const [nodeId, depSet] of deps) {
      if (depSet.has(id)) {
        const newDeg = (inDegree.get(nodeId) ?? 1) - 1;
        inDegree.set(nodeId, newDeg);
        if (newDeg === 0) queue.push(nodeId);
      }
    }
  }
  // Append any unresolved (cycle) nodes
  for (const id of ids) if (!result.includes(id)) result.push(id);

  return result;
}

// ─── Phase 3: Initial Velocity Assignment ────────────────────────────────────

function assignInitialVelocities(
  tick: TickState,
  sortedPlayerIds: number[],
  direction: Direction,
): void {
  // Pre-pass: detect two players trying to push the same box → both blocked
  const boxPushClaims = new Map<number, number[]>(); // boxId → [playerId, ...]
  for (const id of sortedPlayerIds) {
    const entity = tick.entities.find((e) => e.kind === 'player' && e.id === id);
    if (!entity || entity.isLocked) continue;
    const actualDir = resolveDirection(direction, entity.mode!);
    const { dRow, dCol } = DELTA[actualDir];
    const candidate = {
      row: entity.position.row + dRow,
      col: entity.position.col + dCol,
    };
    const resolved = resolveEdgePosition(candidate, tick.level);
    if (!resolved || resolved === 'lava') continue;
    const targetPos = resolved as Position;
    const box = tick.entities.find(
      (e) => e.kind === 'box' && posEqual(e.position, targetPos),
    );
    if (box) {
      const claims = boxPushClaims.get(box.id) ?? [];
      claims.push(id);
      boxPushClaims.set(box.id, claims);
    }
  }
  const conflictedPlayers = new Set<number>();
  for (const [, playerIds] of boxPushClaims) {
    if (playerIds.length > 1) for (const pid of playerIds) conflictedPlayers.add(pid);
  }

  // Assign velocity to each player in dependency order
  for (const id of sortedPlayerIds) {
    const entity = tick.entities.find((e) => e.kind === 'player' && e.id === id);
    if (!entity || entity.isLocked) continue;
    if (conflictedPlayers.has(id)) continue; // box conflict → stay

    const actualDir = resolveDirection(direction, entity.mode!);
    const { dRow, dCol } = DELTA[actualDir];
    const candidate = {
      row: entity.position.row + dRow,
      col: entity.position.col + dCol,
    };
    const resolved = resolveEdgePosition(candidate, tick.level);

    // Immediate lava: end the whole move now
    if (resolved === 'lava') {
      tick.lostReason = 'lava_edge';
      return;
    }

    if (!resolved) continue; // wall → stay

    const cell = tick.grid[resolved.row]?.[resolved.col];
    if (cell === 'obstacle') continue;

    // Check occupant at target
    const occupant = tick.entities.find(
      (e) => !(e.kind === 'player' && e.id === id) && posEqual(e.position, resolved as Position),
    );

    if (occupant) {
      if (occupant.kind === 'box') {
        // Box conflict players were already blocked above; this is a single-player push
        // (collectPushChain will validate further)
        entity.velocity = actualDir; // tentative; actual push happens in tick loop
      } else {
        // Another player is there — check if they're moving away (already processed)
        if (occupant.velocity === null) continue; // staying → blocked
        // Moving away → proceed
        entity.velocity = actualDir;
      }
    } else {
      entity.velocity = actualDir;
    }
  }
}

// ─── Phase 4: Tick Loop ───────────────────────────────────────────────────────

/**
 * Activate stationary entities that are already on an active conveyor.
 * The cycle guard (_conveyorVisited) prevents re-activation of already-used cells.
 */
function activateConveyors(tick: TickState): void {
  for (const entity of tick.entities) {
    if (entity.velocity !== null) continue;
    const cell = tick.grid[entity.position.row]?.[entity.position.col];
    if (!cell) continue;
    const convDir = cellTypeToConveyorDir(cell);
    if (!convDir) continue;
    if (!isConveyorActive(entity.position, tick.level, tick.poweredCells)) continue;
    const key = posKey(entity.position);
    if (entity._conveyorVisited?.has(key)) continue;
    entity.velocity = convDir;
    if (!entity._conveyorVisited) entity._conveyorVisited = new Set();
    entity._conveyorVisited.add(key);
  }
}

function runTickLoop(tick: TickState, sortedPlayerIds: number[]): void {
  for (let t = 0; t < MAX_TICK; t++) {
    if (tick.lostReason) break;

    // Activate conveyors for stationary entities each tick
    activateConveyors(tick);

    const hasMoving = tick.entities.some((e) => e.velocity !== null);
    if (!hasMoving) break;

    const toRemove = new Set<TickEntity>();
    const pendingSideEffects: Array<(tick: TickState) => void> = [];

    // Tick 0: process players in dependency-resolved order (from resolvePlayerOrder)
    // so that a player who must vacate a cell is processed before the one following.
    // Subsequent ticks: stable ID order (ice/conveyor continuation).
    const players = tick.entities.filter((e) => e.kind === 'player');
    const orderedPlayers =
      t === 0
        ? sortedPlayerIds
            .map((id) => players.find((p) => p.id === id))
            .filter((p): p is TickEntity => p !== undefined)
        : players.slice().sort((a, b) => a.id - b.id);

    const orderedEntities = [
      ...orderedPlayers,
      ...tick.entities.filter((e) => e.kind === 'box').sort((a, b) => a.id - b.id),
    ];

    for (const entity of orderedEntities) {
      if (entity.velocity === null) continue;
      if (toRemove.has(entity)) continue;

      const vel = entity.velocity;
      const { dRow, dCol } = DELTA[vel];
      const candidate = {
        row: entity.position.row + dRow,
        col: entity.position.col + dCol,
      };
      const resolved = resolveEdgePosition(candidate, tick.level);

      // ── Lava edge ──────────────────────────────────────────────────────────
      if (resolved === 'lava') {
        entity.velocity = null;
        toRemove.add(entity);
        if (entity.kind === 'player') {
          tick.lostReason = 'lava_edge';
          break; // stop processing this tick immediately
        }
        continue;
      }

      // ── Wall edge ──────────────────────────────────────────────────────────
      if (!resolved) {
        entity.velocity = null;
        continue;
      }

      const cell = (tick.grid[resolved.row]?.[resolved.col] ?? 'empty') as CellType;

      // ── Obstacle ───────────────────────────────────────────────────────────
      if (cell === 'obstacle') {
        entity.velocity = null;
        continue;
      }

      // ── Occupancy check ────────────────────────────────────────────────────
      const occupant = tick.entities.find(
        (e) =>
          !(e.kind === entity.kind && e.id === entity.id) &&
          posEqual(e.position, resolved) &&
          !toRemove.has(e),
      );

      if (occupant) {
        if (occupant.kind === 'box' && occupant.velocity === null) {
          // Static box → attempt immediate chain push
          const pushed = pushChainImmediately(occupant, vel, tick, toRemove);
          if (!pushed) {
            entity.velocity = null;
            continue;
          }
          // Push succeeded: box (chain) has moved forward, entity fills the gap
        } else if (occupant.kind === 'box' && occupant.velocity !== null) {
          // Box already moving — conservative: stop entity (avoid overlap)
          entity.velocity = null;
          continue;
        } else {
          // Player vs player: both stop
          entity.velocity = null;
          occupant.velocity = null;
          continue;
        }
      }

      // ── Move entity ────────────────────────────────────────────────────────
      entity.position = resolved;
      const key = entityKey(entity);
      tick.animationPaths[key].push({ ...resolved });

      // ── Behavior dispatch ──────────────────────────────────────────────────
      const behavior = CELL_BEHAVIORS[cell];
      if (behavior) {
        const ctx = { entity, newPosition: resolved, cellType: cell, tick };
        const result: BehaviorResult = behavior.onEnter(ctx);

        // Teleporter: if exit is occupied by a box, try to push it first.
        // If push fails, cancel the teleport and skip sideEffect (so the
        // cycle guard is not set, allowing re-entry later).
        if (result.exitBoxToPush) {
          const pushed = pushChainImmediately(result.exitBoxToPush, vel, tick, toRemove);
          if (!pushed) {
            entity.velocity = null;
            continue;
          }
          // Push succeeded → fall through to apply overridePosition (teleport)
        }

        if (result.sideEffect) pendingSideEffects.push(result.sideEffect);

        if (result.destroyEntity) {
          entity.velocity = null;
          toRemove.add(entity);
        } else {
          if (result.overridePosition) {
            entity.position = result.overridePosition;
            tick.animationPaths[key].push({ ...result.overridePosition });
          }
          entity.velocity = result.velocity;
        }
      } else {
        // No registered behavior → entity stops (empty, target_1/2, etc.)
        entity.velocity = null;
      }
    }

    // Apply all side effects after the full entity pass
    for (const fn of pendingSideEffects) fn(tick);

    // Remove destroyed entities
    if (toRemove.size > 0) {
      tick.entities = tick.entities.filter((e) => !toRemove.has(e));
    }

    if (tick.lostReason) break;
  }
}

// ─── Phase 5: Finalize → GameState ───────────────────────────────────────────

function finalizeTickState(tick: TickState, prev: GameState): GameState {
  // Rebuild objects from TickEntities (players can't be destroyed)
  const newObjects = prev.objects.map((obj) => {
    const entity = tick.entities.find((e) => e.kind === 'player' && e.id === obj.id);
    if (!entity) return obj;

    const target = tick.level.targets.find((t) => t.objectId === obj.id);
    const onTarget = target !== undefined && posEqual(entity.position, target.position);
    const newIsLocked = obj.isLocked || (obj.lockOnTarget && onTarget);

    return {
      ...obj,
      position: entity.position,
      mode: entity.mode ?? obj.mode,
      isLocked: newIsLocked,
    };
  });

  // Rebuild boxes (destroyed boxes are simply absent from tick.entities)
  const newBoxes = prev.boxes
    .map((box) => {
      const entity = tick.entities.find((e) => e.kind === 'box' && e.id === box.id);
      return entity ? { ...box, position: entity.position } : null;
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  // Update trail: record the starting position of players that moved
  let newTrail = tick.trail;
  for (const obj of prev.objects) {
    const entity = tick.entities.find((e) => e.kind === 'player' && e.id === obj.id);
    if (!entity) continue;
    const moved = !posEqual(entity.position, obj.position);
    if (moved && (tick.level.trailCollision || tick.poweredPlayers.includes(obj.id))) {
      newTrail = addToTrail(newTrail, obj.id, obj.position);
    }
  }

  // Trail collision check (evaluated after all movement, like the original)
  let lostReason = tick.lostReason;
  if (!lostReason && tick.level.trailCollision) {
    for (const obj of newObjects) {
      for (const other of newObjects) {
        if (other.id === obj.id) continue;
        const otherTrail = newTrail[other.id] ?? [];
        if (otherTrail.some((p) => posEqual(p, obj.position))) {
          lostReason = 'trail';
          break;
        }
      }
      if (lostReason) break;
    }
  }

  // Win condition
  const didWin = !lostReason && checkWinCondition(newObjects, tick.level.targets);

  // Derive moveAnimTypes for backward compat (sound system reads this)
  const moveAnimTypes = deriveMoveAnimTypes(tick, prev);

  return {
    ...prev,
    objects: newObjects,
    boxes: newBoxes,
    poweredPlayers: tick.poweredPlayers,
    trail: newTrail,
    phase: lostReason ? 'lost' : didWin ? 'won' : 'playing',
    lostReason,
    moveCount: prev.moveCount + 1,
    moveAnimTypes,
    animationPaths: tick.animationPaths,
  };
}

/**
 * Derives the legacy moveAnimTypes map from animationPaths for backward
 * compatibility with the GameShell sound system.
 */
function deriveMoveAnimTypes(
  tick: TickState,
  prev: GameState,
): Record<number, MoveAnimType> {
  const result: Record<number, MoveAnimType> = {};

  for (const obj of prev.objects) {
    if (obj.isLocked) { result[obj.id] = 'normal'; continue; }

    const path = tick.animationPaths[`player:${obj.id}`] ?? [];

    // Teleport: path passes through a teleporter cell
    const usedTeleporter = path.some((p) => {
      const c = tick.grid[p.row]?.[p.col];
      return c?.startsWith('teleporter');
    });
    if (usedTeleporter) { result[obj.id] = 'teleport'; continue; }

    // Portal: consecutive positions that are non-adjacent (edge wrap)
    const hasPortalJump = path.some((p, i) => {
      if (i === 0) return false;
      const prev = path[i - 1];
      return Math.abs(p.row - prev.row) > 1 || Math.abs(p.col - prev.col) > 1;
    });
    if (hasPortalJump) { result[obj.id] = 'portal'; continue; }

    // Ice: path length > 2 (entity slid multiple steps)
    if (path.length > 2) {
      const usedIce = path.some((p) => tick.grid[p.row]?.[p.col] === 'ice');
      if (usedIce) { result[obj.id] = 'ice'; continue; }
    }

    // Conveyor: path passes through a conveyor cell
    const usedConveyor = path.some((p) => {
      const c = tick.grid[p.row]?.[p.col];
      return c?.startsWith('conveyor');
    });
    if (usedConveyor) { result[obj.id] = 'conveyor'; continue; }

    result[obj.id] = 'normal';
  }

  return result;
}
