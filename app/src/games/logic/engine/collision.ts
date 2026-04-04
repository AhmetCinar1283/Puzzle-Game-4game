import type { Direction, Position, CellType } from '../../types';
import type { TickEntity, TickState, BehaviorResult } from './types';
import { DELTA, posEqual } from '../positionUtils';
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

  const cell = tick.grid[resolved.row]?.[resolved.col];
  if (cell === 'obstacle') return null;

  // Static box in the way → extend chain
  const blockingBox = tick.entities.find(
    (e) => e.kind === 'box' && e.velocity === null && posEqual(e.position, resolved),
  );
  if (blockingBox) {
    const sub = collectPushChain(blockingBox, direction, tick, new Set([...visited, box.id]));
    if (!sub) return null;
    return [{ entity: box, nextPos: resolved }, ...sub];
  }

  // Player in the way → blocked
  const blockingPlayer = tick.entities.find(
    (e) => e.kind === 'player' && posEqual(e.position, resolved),
  );
  if (blockingPlayer) return null;

  return [{ entity: box, nextPos: resolved }];
}

/**
 * Atomically pushes a box chain one step in the given direction.
 *
 * All boxes in the chain are moved immediately (back-to-front to avoid
 * position conflicts). Behavior modules (ice, conveyor, teleporter…) are
 * invoked for each box's landing cell. Side effects are batched and applied
 * after all boxes have moved.
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
      toRemove.add(box);
      box.velocity = null;
      continue;
    }

    // Move box to nextPos
    const key = `${box.kind}:${box.id}`;
    box.position = nextPos;
    tick.animationPaths[key] = tick.animationPaths[key] ?? [{ ...nextPos }];
    tick.animationPaths[key].push({ ...nextPos });

    // Dispatch behavior at landing cell
    const cell = tick.grid[nextPos.row]?.[nextPos.col] as CellType | undefined;
    const behavior = cell ? CELL_BEHAVIORS[cell] : undefined;
    if (behavior) {
      const ctx = { entity: box, newPosition: nextPos, cellType: cell!, tick };
      const result: BehaviorResult = behavior.onEnter(ctx);
      if (result.sideEffect) pendingSideEffects.push(result.sideEffect);
      if (result.destroyEntity) {
        toRemove.add(box);
        box.velocity = null;
      } else {
        if (result.overridePosition) {
          box.position = result.overridePosition;
          tick.animationPaths[key].push({ ...result.overridePosition });
        }
        box.velocity = result.velocity;
      }
    }
    // else: no behavior → box.velocity stays null (box stops)
  }

  for (const fn of pendingSideEffects) fn(tick);

  return true;
}
