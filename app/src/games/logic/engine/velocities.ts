import type { Direction } from '../../types';
import type { TickState } from './types';
import { DELTA, posKey, cellTypeToConveyorDir } from '../positionUtils';
import { resolveEdgePosition, resolveDirection } from '../movementHelpers';
import { canConveyorFire, decrementConveyorUse, getConveyorConfig } from '../powerSystem';

/**
 * Assigns initial velocities to all user-controlled entities.
 * Force = mass × 1 (user input always moves exactly 1 step on normal ground).
 */
export function assignInitialVelocities(tick: TickState, direction: Direction): void {
  const controlled = tick.entities.filter((e) => e.behavior.isUserControlled);

  // Pre-pass: two players pushing the same push-chain entity → both blocked
  const boxPushClaims = new Map<number, number[]>();
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

  for (const entity of controlled) {
    if (entity.isLocked) continue;
    if (conflictedPlayers.has(entity.id)) continue;

    const actualDir = resolveDirection(direction, entity.mode!);
    const { dRow, dCol } = DELTA[actualDir];
    const candidate = { row: entity.position.row + dRow, col: entity.position.col + dCol };
    const resolved = resolveEdgePosition(candidate, tick.level);

    if (resolved === 'lava') {
      tick.lostReason = 'lava_edge';
      return;
    }
    if (!resolved) continue;

    const cellType = tick.grid[resolved.row]?.[resolved.col]?.type;
    if (cellType === 'obstacle') continue;

    const targetCell = tick.grid[resolved.row]?.[resolved.col];
    const occupantId = targetCell?.occupantIds.find((id) => id !== entity.id);
    if (occupantId !== undefined) {
      const occupant = tick.entities.find((e) => e.id === occupantId);
      if (occupant) {
        if (occupant.behavior.isPushChainRoot) {
          entity.velocity = actualDir;
          entity.force = entity.mass ?? 1; // 1 adım kuvvet
        } else {
          if (occupant.velocity === null) continue;
          entity.velocity = actualDir;
          entity.force = entity.mass ?? 1;
        }
      }
    } else {
      entity.velocity = actualDir;
      entity.force = entity.mass ?? 1;
    }
  }
}

/**
 * Activate stationary entities already on an active conveyor.
 * Sets velocity and force = mass × cfg.steps.
 * Cycle guard (_conveyorVisited) prevents re-activation.
 */
export function activateConveyors(tick: TickState): void {
  for (const entity of tick.entities) {
    if (entity.velocity !== null) continue;
    if (entity.force > 0) continue; // zaten kuvvet var, conveyor üzerine yazmasın
    const cellType = tick.grid[entity.position.row]?.[entity.position.col]?.type;
    if (!cellType) continue;
    const convDir = cellTypeToConveyorDir(cellType);
    if (!convDir) continue;
    if (!canConveyorFire(entity.position, tick.level, tick.poweredCells, tick.conveyorRemainingUses)) continue;
    const key = posKey(entity.position);
    if (entity._conveyorVisited?.has(key)) continue;

    const cfg = getConveyorConfig(tick.level, entity.position);
    entity.velocity = convDir;
    entity.force = (entity.mass ?? 1) * cfg.steps;
    entity.momentum = undefined; // eski sistemi temizle
    if (!entity._conveyorVisited) entity._conveyorVisited = new Set();
    entity._conveyorVisited.add(key);
    decrementConveyorUse(entity.position, tick.level, tick.conveyorRemainingUses);
  }
}
