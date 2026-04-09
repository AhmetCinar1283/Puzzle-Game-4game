import type { Direction, Position, CellType } from '../../types';
import type { TickEntity, TickState, BehaviorResult } from './types';
import { removeFromGrid, addToGrid } from './types';
import { DELTA } from '../positionUtils';
import { resolveEdgePosition } from '../movementHelpers';
import { isBoxPushable } from '../powerSystem';
import { CELL_BEHAVIORS } from '../behaviors/registry';

export { resolveEdgePosition } from '../movementHelpers';

// ─── Chain resolution types ───────────────────────────────────────────────────

type ChainLink = { entity: TickEntity; nextPos: Position | 'lava' };

/**
 * Recursively collects all boxes in a push chain without modifying positions.
 * Returns null if the chain is blocked (wall, obstacle, power-locked, player).
 * A 'lava' nextPos means the box will be destroyed — the push still succeeds.
 */
function collectPushChain(
  box: TickEntity,
  direction: Direction,
  tick: TickState,
  visited: Set<number>,
): ChainLink[] | null {
  if (visited.has(box.id)) return null; // cycle in chain

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

  if (!resolved) return null; // wall edge
  if (resolved === 'lava') return [{ entity: box, nextPos: 'lava' }];

  const cellType = tick.grid[resolved.row]?.[resolved.col]?.type;
  if (cellType === 'obstacle') return null;

  // Static push-chain entity in the way → extend chain
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

  // User-controlled entity in the way → blocked only if NOT moving in same push direction
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
 * Atomically pushes a box chain one step in the given direction.
 *
 * All boxes in the chain are moved immediately (back-to-front to avoid
 * position conflicts). Behavior modules (ice, conveyor, teleporter…) are
 * invoked for each box's landing cell. Side effects are batched and applied
 * after all boxes have moved. Grid occupancy (CellState.occupantIds) is
 * updated as each box moves.
 *
 * Returns true if the push succeeded; false if the chain is blocked.
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

  // Process back-to-front: last box in chain moves first (clears the way)
  for (let i = chain.length - 1; i >= 0; i--) {
    const { entity: box, nextPos } = chain[i];

    if (nextPos === 'lava') {
      removeFromGrid(tick, box);
      toRemove.add(box);
      box.velocity = null;
      continue;
    }

    // Move box to nextPos — update grid occupancy
    const key = `${box.kind}:${box.id}`;
    removeFromGrid(tick, box);
    box.position = nextPos;
    addToGrid(tick, nextPos, box);
    tick.animationPaths[key] = tick.animationPaths[key] ?? [{ ...nextPos, z: box.z }];
    tick.animationPaths[key].push({ ...nextPos, z: box.z });

    // Dispatch behavior at landing cell
    const targetCell = tick.grid[nextPos.row]?.[nextPos.col];
    const cellType = targetCell?.type as CellType | undefined;
    const behavior = cellType ? CELL_BEHAVIORS[cellType] : undefined;
    if (behavior) {
      // Set box velocity to the push direction so ice/conveyor behaviors can
      // read it. The behavior result will override this value.
      box.velocity = direction;
      const ctx = {
        entity: box,
        newPosition: nextPos,
        cellType: cellType!,
        targetCell: targetCell!,
        tick,
      };
      const result: BehaviorResult = behavior.onEnter(ctx);
      if (result.sideEffect) pendingSideEffects.push(result.sideEffect);
      if (result.destroyEntity) {
        removeFromGrid(tick, box);
        toRemove.add(box);
        box.velocity = null;
      } else {
        if (result.overridePosition) {
          removeFromGrid(tick, box);
          box.position = result.overridePosition;
          addToGrid(tick, result.overridePosition, box);
          tick.animationPaths[key].push({ ...result.overridePosition, z: box.z });
        }
        box.velocity = result.velocity;
      }
    }
    // else: no behavior → box.velocity stays null (box stops)
  }

  for (const fn of pendingSideEffects) fn(tick);

  return true;
}
