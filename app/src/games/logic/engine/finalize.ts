import type { GameState, GameObjectState, BoxState, MoveAnimType } from '../../types';
import type { TickState } from './types';
import { posEqual } from '../positionUtils';
import { addToTrail, checkWinCondition } from '../movementHelpers';

export function finalizeTickState(tick: TickState, prev: GameState): GameState {
  const newObjects: GameObjectState[] = [];
  const newBoxes: BoxState[] = [];
  let newTrail = tick.trail;

  // Reconstruct public state via each entity's onFinalize hook
  for (const tickEnt of tick.entities) {
    const result = tickEnt.behavior.onFinalize({ tickEntity: tickEnt, prevState: prev, tick });
    if (result.kind === 'player_state') {
      newObjects.push(result.state);
      if (result.trailEntry) {
        newTrail = addToTrail(newTrail, tickEnt.id, result.trailEntry);
      }
    } else if (result.kind === 'box_state') {
      newBoxes.push(result.state);
    }
    // 'destroyed' → omit from output (entity was removed from tick.entities already)
  }

  // Maintain prev.objects ordering for players (animation system depends on stable order)
  newObjects.sort((a, b) => {
    const ia = prev.objects.findIndex((o) => o.id === a.id);
    const ib = prev.objects.findIndex((o) => o.id === b.id);
    return ia - ib;
  });

  // Trail collision check
  let lostReason = tick.lostReason;
  if (!lostReason && tick.level.trailCollision) {
    outer: for (const obj of newObjects) {
      for (const other of newObjects) {
        if (other.id === obj.id) continue;
        const otherTrail = newTrail[other.id] ?? [];
        if (otherTrail.some((p) => posEqual(p, obj.position))) {
          lostReason = 'trail';
          break outer;
        }
      }
    }
  }

  const didWin = !lostReason && checkWinCondition(newObjects, tick.level.targets);
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
    conveyorRemainingUses: tick.conveyorRemainingUses,
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

    const usedTeleporter = path.some((p) => {
      const c = tick.grid[p.row]?.[p.col]?.type;
      return c?.startsWith('teleporter');
    });
    if (usedTeleporter) { result[obj.id] = 'teleport'; continue; }

    const hasPortalJump = path.some((p, i) => {
      if (i === 0) return false;
      const prev = path[i - 1];
      return Math.abs(p.row - prev.row) > 1 || Math.abs(p.col - prev.col) > 1;
    });
    if (hasPortalJump) { result[obj.id] = 'portal'; continue; }

    if (path.length > 2) {
      const usedIce = path.some((p) => tick.grid[p.row]?.[p.col]?.type === 'ice');
      if (usedIce) { result[obj.id] = 'ice'; continue; }
    }

    const usedConveyor = path.some((p) => {
      const c = tick.grid[p.row]?.[p.col]?.type;
      return c?.startsWith('conveyor');
    });
    if (usedConveyor) { result[obj.id] = 'conveyor'; continue; }

    result[obj.id] = 'normal';
  }

  return result;
}
