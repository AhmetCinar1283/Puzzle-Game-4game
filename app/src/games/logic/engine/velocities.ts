import type { Direction } from '../../types';
import type { TickState } from './types';
import { DELTA, posKey, cellTypeToConveyorDir } from '../positionUtils';
import { resolveEdgePosition, resolveDirection } from '../movementHelpers';
import { canConveyorFire, decrementConveyorUse, getConveyorConfig } from '../powerSystem';

/**
 * Assigns initial velocities to all user-controlled entities.
 *
 * No ordering: all entities receive their direction simultaneously.
 * Follow-through and head-on collisions are handled by the fixpoint loop.
 *
 * Keeps a pre-pass for the one case that can't resolve in the loop:
 * two players simultaneously pushing the same push-chain entity → both blocked.
 */
export function assignInitialVelocities(tick: TickState, direction: Direction): void {
  const controlled = tick.entities.filter((e) => e.behavior.isUserControlled);

  // Pre-pass: detect two players trying to push the same push-chain entity → both blocked
  const boxPushClaims = new Map<number, number[]>(); // entityId → [moverId, ...]
  for (const entity of controlled) {
    if (entity.isLocked) continue;
    const actualDir = resolveDirection(direction, entity.mode!);
    const { dRow, dCol } = DELTA[actualDir];
    const candidate = { row: entity.position.row + dRow, col: entity.position.col + dCol };
    const resolved = resolveEdgePosition(candidate, tick.level);
    if (!resolved || resolved === 'lava') continue;
    const targetCell = tick.grid[resolved.row]?.[resolved.col];
    if (!targetCell) continue;
    const pushTargetId = targetCell.occupantIds.find((id) => {
      const e = tick.entities.find((x) => x.id === id);
      return e?.behavior.isPushChainRoot;
    });
    if (pushTargetId !== undefined) {
      const claims = boxPushClaims.get(pushTargetId) ?? [];
      claims.push(entity.id);
      boxPushClaims.set(pushTargetId, claims);
    }
  }
  const conflictedPlayers = new Set<number>();
  for (const [, playerIds] of boxPushClaims) {
    if (playerIds.length > 1) for (const pid of playerIds) conflictedPlayers.add(pid);
  }

  // Assign velocity to each user-controlled entity
  for (const entity of controlled) {
    if (entity.isLocked) continue;
    if (conflictedPlayers.has(entity.id)) continue;

    const actualDir = resolveDirection(direction, entity.mode!);
    const { dRow, dCol } = DELTA[actualDir];
    const candidate = { row: entity.position.row + dRow, col: entity.position.col + dCol };
    const resolved = resolveEdgePosition(candidate, tick.level);

    // Immediate lava: end the whole move now
    if (resolved === 'lava') {
      tick.lostReason = 'lava_edge';
      return;
    }

    if (!resolved) continue; // wall → stay

    const cellType = tick.grid[resolved.row]?.[resolved.col]?.type;
    if (cellType === 'obstacle') continue;

    // Check occupant at target: push-chain roots are handled in the loop;
    // a moving entity vacates before we arrive → proceed.
    const targetCell = tick.grid[resolved.row]?.[resolved.col];
    const occupantId = targetCell?.occupantIds.find((id) => id !== entity.id);
    if (occupantId !== undefined) {
      const occupant = tick.entities.find((e) => e.id === occupantId);
      if (occupant) {
        if (occupant.behavior.isPushChainRoot) {
          entity.velocity = actualDir; // tentative; actual push happens in tick loop
        } else {
          if (occupant.velocity === null) continue; // staying → blocked
          entity.velocity = actualDir; // moving away → proceed (fixpoint handles follow-through)
        }
      }
    } else {
      entity.velocity = actualDir;
    }
  }
}

/**
 * Activate stationary entities that are already on an active conveyor.
 * Sets velocity and conveyor momentum (for n-step sliding).
 * The cycle guard (_conveyorVisited) prevents re-activation of already-used cells.
 */
export function activateConveyors(tick: TickState): void {
  for (const entity of tick.entities) {
    if (entity.velocity !== null) continue;
    if (entity.momentum) continue; // already has momentum from a prior conveyor
    const cellType = tick.grid[entity.position.row]?.[entity.position.col]?.type;
    if (!cellType) continue;
    const convDir = cellTypeToConveyorDir(cellType);
    if (!convDir) continue;
    if (!canConveyorFire(entity.position, tick.level, tick.poweredCells, tick.conveyorRemainingUses)) continue;
    const key = posKey(entity.position);
    if (entity._conveyorVisited?.has(key)) continue;

    const cfg = getConveyorConfig(tick.level, entity.position);
    entity.velocity = convDir;
    entity.momentum = { dir: convDir, stepsLeft: cfg.steps, totalSteps: cfg.steps };
    if (!entity._conveyorVisited) entity._conveyorVisited = new Set();
    entity._conveyorVisited.add(key);
    decrementConveyorUse(entity.position, tick.level, tick.conveyorRemainingUses);
  }
}
