import type { Direction, Position, CellType } from '../../types';
import type { TickEntity, TickState, BehaviorResult } from './types';
import { removeFromGrid, addToGrid } from './types';
import { DELTA } from '../positionUtils';
import { resolveEdgePosition } from '../movementHelpers';
import { isBoxPushable } from '../powerSystem';
import { CELL_BEHAVIORS } from '../behaviors/registry';
import { buildBehaviorCtx, buildLeaveCtx } from './contextUtils';

export { resolveEdgePosition } from '../movementHelpers';

// ─── Chain Resolution Types ───────────────────────────────────────────────────

type ChainLink = { entity: TickEntity; nextPos: Position | 'lava' };

/**
 * Finds all boxes to push without moving them yet.
 * Returns null if the path is blocked.
 * If the next cell is 'lava', the box will be destroyed but the push still works.
 */
function collectPushChain(
  box: TickEntity,
  direction: Direction,
  tick: TickState,
  visited: Set<number>,
): ChainLink[] | null {
  if (visited.has(box.id)) return null; // Stop if we see the same box again (cycle)

  const boxState = {
    id: box.id,
    position: box.position,
    requiresPower: box.requiresPower ?? false,
  };
  if (!isBoxPushable(boxState, tick.poweredCells)) return null;

  const { dRow, dCol } = DELTA[direction];
  const candidate: Position = {
    row: box.position.row + dRow,
    col: box.position.col + dCol,
  };
  const resolved = resolveEdgePosition(candidate, tick.level);

  if (!resolved) return null; // Blocked by a wall
  if (resolved === 'lava') return [{ entity: box, nextPos: 'lava' }];

  const cellType = tick.grid[resolved.row]?.[resolved.col]?.type;
  if (cellType === 'obstacle') return null;

  // If there is another box, add it to the chain
  const targetCell = tick.grid[resolved.row]?.[resolved.col];
  const blockingBoxId = targetCell?.occupantIds.find((id) => {
    const e = tick.entities.find((x) => x.id === id);
    return e?.behavior.isPushChainRoot && e.velocity === null;
  });
  if (blockingBoxId !== undefined) {
    const blockingBox = tick.entities.find((e) => e.id === blockingBoxId)!;
    const sub = collectPushChain(blockingBox, direction, tick, new Set([...visited, box.id]));
    if (!sub) return null;
    return [{ entity: box, nextPos: resolved }, ...sub];
  }

  // If a player is in the way, block unless they are moving in the same direction
  const blockingPlayerId = targetCell?.occupantIds.find((id) => {
    const e = tick.entities.find((x) => x.id === id);
    return e?.behavior.isUserControlled;
  });
  if (blockingPlayerId !== undefined) {
    const blockingPlayer = tick.entities.find((e) => e.id === blockingPlayerId)!;
    if (blockingPlayer.velocity !== direction) return null;
  }

  return [{ entity: box, nextPos: resolved }];
}

/**
 * Moves a line of boxes one step.
 * Moves the last box first to prevent overlapping.
 * Runs cell behaviors (like ice or teleporters) for each box.
 * Returns true if pushed successfully, false if blocked.
 */
export function pushChainImmediately(
  firstBox: TickEntity,
  direction: Direction,
  tick: TickState,
  toRemove: Set<TickEntity>,
): boolean {
  const chain = collectPushChain(firstBox, direction, tick, new Set());
  if (!chain) return false;

  const pendingSideEffects: Array<(tick: TickState) => void> = [];

  // Move the last box first to make room
  for (let i = chain.length - 1; i >= 0; i--) {
    const { entity: box, nextPos } = chain[i];

    if (nextPos === 'lava') {
      removeFromGrid(tick, box);
      toRemove.add(box);
      box.velocity = null;
      continue;
    }

    // ── onLeave — Box is leaving its current cell ────────────────────────────
    {
      const leavingCell = tick.grid[box.position.row]?.[box.position.col];
      const leavingBehavior = leavingCell ? CELL_BEHAVIORS[leavingCell.type as CellType] : undefined;
      if (leavingBehavior?.onLeave) {
        const leaveCtx = buildLeaveCtx(box, nextPos, tick);
        const leaveResult = leavingBehavior.onLeave(leaveCtx);
        if (leaveResult?.sideEffect) pendingSideEffects.push(leaveResult.sideEffect);
      }
    }

    // Move box to the next cell
    const key = `${box.kind}:${box.id}`;
    removeFromGrid(tick, box);
    box.position = nextPos;
    addToGrid(tick, nextPos, box);
    tick.animationPaths[key] = tick.animationPaths[key] ?? [{ ...nextPos, z: box.z }];
    tick.animationPaths[key].push({ ...nextPos, z: box.z });

    // ── onEnter + force yönetimi ──────────────────────────────────────────────
    const targetCell = tick.grid[nextPos.row]?.[nextPos.col];
    const cellType = targetCell?.type as CellType | undefined;
    const behavior = cellType ? CELL_BEHAVIORS[cellType] : undefined;
    const boxMass = box.mass ?? 1;

    // Bu adım için force deduction (pushChainImmediately her zaman 1 adım hareket eder)
    const frictionless = behavior?.frictionless ?? false;
    if (!frictionless) {
      box.force -= boxMass;
      if (box.force < 0) box.force = 0;
    }

    if (behavior) {
      box.velocity = direction; // behavior okuyabilsin diye geçici set
      const ctx = buildBehaviorCtx(box, nextPos, targetCell!, cellType!, tick);
      const result: BehaviorResult = behavior.onEnter(ctx);

      if (result.sideEffect) pendingSideEffects.push(result.sideEffect);

      if (result.destroyEntity) {
        removeFromGrid(tick, box);
        toRemove.add(box);
        box.velocity = null;
        box.force = 0;
      } else {
        if (result.overridePosition) {
          removeFromGrid(tick, box);
          box.position = result.overridePosition;
          addToGrid(tick, result.overridePosition, box);
          tick.animationPaths[key].push({ ...result.overridePosition, z: box.z });
        }
        // Behavior'ın döndürdüğü velocity veya kalan force ile devam kararı
        if (result.velocity !== null) {
          box.velocity = result.velocity;
        } else {
          // Behavior durdurdu — ama force varsa aynı yönde devam
          const stillHasForce = frictionless ? box.force > 0 : box.force >= boxMass;
          box.velocity = stillHasForce ? direction : null;
          if (!stillHasForce) box.force = 0;
        }
      }
    } else {
      // Behavior yok (normal boş hücre) — force varsa devam, yoksa dur
      const stillHasForce = frictionless ? box.force > 0 : box.force >= boxMass;
      box.velocity = stillHasForce ? direction : null;
      if (!stillHasForce) box.force = 0;
    }
  }

  // Apply all collected side effects at the end
  for (const fn of pendingSideEffects) fn(tick);

  return true;
}