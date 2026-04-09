import type { CellType } from '../../types';
import type { TickState, TickEntity, BehaviorResult } from './types';
import { entityKey, removeFromGrid, addToGrid, getOccupantEntity } from './types';
import { DELTA, posEqual } from '../positionUtils';
import { resolveEdgePosition } from '../movementHelpers';
import { pushChainImmediately } from './collision';
import { CELL_BEHAVIORS } from '../behaviors/registry';
import { activateConveyors } from './velocities';

const MAX_TICK = 64;

/**
 * Reads the current-step z from an entity's momentum arc.
 * Called at the START of processing each entity, before the move.
 */
function readMomentumZ(entity: TickEntity): number {
  if (!entity.momentum?.zProfile) return 0;
  const stepIndex = entity.momentum.totalSteps - entity.momentum.stepsLeft;
  return entity.momentum.zProfile[stepIndex] ?? 0;
}

/**
 * Applies remaining momentum steps: if velocity would be null, restore it from
 * momentum and advance the step counter. Call AFTER behavior sets entity.velocity.
 */
function applyMomentumRestore(entity: TickEntity): void {
  if (entity.velocity !== null || !entity.momentum) return;
  if (entity.momentum.stepsLeft > 0) {
    entity.velocity = entity.momentum.dir;
  } else {
    entity.momentum = undefined;
    entity.z = 0;
  }
}

/**
 * Clears momentum and resets z. Used when the entity is forcibly stopped
 * (wall, obstacle, lava, mutual_stop, push_blocked).
 */
function clearMomentum(entity: TickEntity): void {
  entity.momentum = undefined;
  entity.z = 0;
}

/**
 * Main movement loop — fixpoint: repeats steps until no entity moved.
 *
 * 2.5D momentum system:
 *  - Each step, entity.z is read from momentum.zProfile before the move.
 *  - z > 0 (airborne): lava edge skipped (no death), obstacle skipped, canEnter
 *    skipped, occupancy skipped — entity flies over ground-level content.
 *  - z: > 0 → 0 on a step = landing: crush check fires before normal collision.
 *  - Momentum stepsLeft is decremented AFTER each successful move.
 */
export function runTickLoop(tick: TickState): void {
  for (let step = 0; step < MAX_TICK; step++) {
    if (tick.lostReason) break;

    activateConveyors(tick);

    if (!tick.entities.some((e) => e.velocity !== null)) break;

    const toRemove = new Set<TickEntity>();
    const pendingSideEffects: Array<(tick: TickState) => void> = [];
    let movedAny = false;

    // Deterministic within-step order: by id (players 1,2 before boxes)
    const ordered = [...tick.entities].sort((a, b) => a.id - b.id);

    for (const entity of ordered) {
      if (entity.velocity === null) continue;
      if (toRemove.has(entity)) continue;

      // ── Z for this step (read from momentum arc BEFORE the move) ────────────
      const prevZ = entity.z;
      entity.z = readMomentumZ(entity);
      const isAirborne = entity.z > 0;
      const isLanding = prevZ > 0 && entity.z === 0; // z transitions down to ground

      const vel = entity.velocity;
      const { dRow, dCol } = DELTA[vel];
      const candidate = { row: entity.position.row + dRow, col: entity.position.col + dCol };
      const resolved = resolveEdgePosition(candidate, tick.level);

      // ── Lava edge ────────────────────────────────────────────────────────────
      if (resolved === 'lava') {
        clearMomentum(entity);
        entity.velocity = null;
        if (isAirborne) continue; // flying over edge → stop safely, no death
        const { halt } = entity.behavior.onLavaEdge(entity, tick, toRemove);
        if (halt) break;
        continue;
      }

      // ── Wall / portal edge ───────────────────────────────────────────────────
      if (!resolved) {
        clearMomentum(entity);
        entity.velocity = null;
        continue; // same for ground and airborne — can't pass a physical wall
      }

      const targetCell = tick.grid[resolved.row]?.[resolved.col];
      const cellType = (targetCell?.type ?? 'empty') as CellType;

      // ── Obstacle (ground only) ───────────────────────────────────────────────
      if (cellType === 'obstacle' && !isAirborne) {
        clearMomentum(entity);
        entity.velocity = null;
        continue;
      }

      // ── canEnter gate (behavior opt-in, skipped while airborne) ─────────────
      const behavior = CELL_BEHAVIORS[cellType];
      if (!isAirborne && behavior?.canEnter) {
        const ctx = { entity, newPosition: resolved, cellType, targetCell: targetCell!, tick };
        if (!behavior.canEnter(ctx)) {
          clearMomentum(entity);
          entity.velocity = null;
          continue;
        }
      }

      // ── Crush-on-landing check (z: > 0 → 0) ─────────────────────────────────
      // Before normal occupancy logic: if entity is landing from a jump,
      // crush whatever is at the target cell (box → destroy, player → crushed).
      if (isLanding) {
        const atLanding = tick.entities.filter(
          (e) =>
            !(e.kind === entity.kind && e.id === entity.id) &&
            posEqual(e.position, resolved) &&
            !toRemove.has(e),
        );
        for (const target of atLanding) {
          if (target.behavior.isDestructible) {
            removeFromGrid(tick, target);
            toRemove.add(target);
          } else {
            tick.lostReason = 'crushed';
          }
        }
        if (tick.lostReason) break;
      }

      // ── Occupancy check (skipped while airborne) ─────────────────────────────
      if (!isAirborne) {
        const occupant = getOccupantEntity(tick, resolved, entity.id, toRemove);
        if (occupant) {
          const result = occupant.behavior.onPushed(occupant, entity, tick, toRemove);
          switch (result.outcome) {
            case 'push_succeeded':
              break; // mover continues into vacated cell
            case 'push_blocked':
              clearMomentum(entity);
              entity.velocity = null;
              continue;
            case 'mutual_stop':
              clearMomentum(entity);
              clearMomentum(occupant);
              entity.velocity = null;
              occupant.velocity = null;
              continue;
            case 'occupant_moving':
              // Mover KEEPS velocity — fixpoint retries when occupant vacates.
              continue;
          }
        }
      }

      // ── Move entity ──────────────────────────────────────────────────────────
      removeFromGrid(tick, entity);
      entity.position = resolved;
      addToGrid(tick, resolved, entity);
      const key = entityKey(entity);
      tick.animationPaths[key].push({ ...resolved, z: entity.z });
      movedAny = true;

      // Decrement momentum step counter after successful move
      if (entity.momentum) {
        entity.momentum.stepsLeft--;
        if (entity.momentum.stepsLeft <= 0) {
          entity.momentum = undefined;
          entity.z = 0;
        }
      }

      // ── Behavior dispatch (onEnter) — skipped while airborne ─────────────────
      if (!isAirborne && behavior) {
        const ctx = {
          entity,
          newPosition: resolved,
          cellType,
          targetCell: targetCell!,
          tick,
        };
        const result: BehaviorResult = behavior.onEnter(ctx);

        // Teleporter: if exit is occupied by a pushable entity, try push first
        if (result.exitBoxToPush) {
          const pushed = pushChainImmediately(result.exitBoxToPush, vel, tick, toRemove);
          if (!pushed) {
            entity.velocity = null;
            clearMomentum(entity);
            continue;
          }
        }

        if (result.sideEffect) pendingSideEffects.push(result.sideEffect);

        if (result.destroyEntity) {
          entity.velocity = null;
          clearMomentum(entity);
          removeFromGrid(tick, entity);
          toRemove.add(entity);
        } else {
          if (result.overridePosition) {
            removeFromGrid(tick, entity);
            entity.position = result.overridePosition;
            addToGrid(tick, result.overridePosition, entity);
            tick.animationPaths[key].push({ ...result.overridePosition, z: entity.z });
          }
          entity.velocity = result.velocity;
          applyMomentumRestore(entity);
        }
      } else {
        // No behavior (empty cell, or airborne over any cell): apply momentum restore
        entity.velocity = null;
        applyMomentumRestore(entity);
      }
    }

    for (const fn of pendingSideEffects) fn(tick);

    if (toRemove.size > 0) {
      tick.entities = tick.entities.filter((e) => !toRemove.has(e));
    }

    // Fixpoint: stop if nothing moved this step
    if (!movedAny) break;
    if (tick.lostReason) break;
  }
}
