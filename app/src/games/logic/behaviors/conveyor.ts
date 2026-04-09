import type { CellBehavior } from './registry';
import type { BehaviorResult } from '../engine/types';
import { cellTypeToConveyorDir, posKey } from '../positionUtils';
import { canConveyorFire, decrementConveyorUse, getConveyorConfig } from '../powerSystem';

/**
 * Conveyor: overrides entity velocity with the conveyor's direction and
 * applies n-step momentum so the entity slides multiple cells.
 *
 * Cycle guard: each conveyor cell is tracked per-entity via _conveyorVisited.
 * If the entity has already been activated by this cell during the current
 * move resolution, it stops here — preventing infinite conveyor loops.
 *
 * The tick loop also calls this behavior for stationary entities already
 * sitting on a conveyor at the start of a turn (see activateConveyors in velocities.ts).
 */
export const conveyorBehavior: CellBehavior = {
  onEnter(ctx): BehaviorResult {
    const { entity, newPosition, cellType, tick } = ctx;

    const convDir = cellTypeToConveyorDir(cellType);
    if (!convDir) return { velocity: null };

    // Power + use-count check
    if (!canConveyorFire(newPosition, tick.level, tick.poweredCells, tick.conveyorRemainingUses)) {
      return { velocity: null };
    }

    // Cycle guard
    const key = posKey(newPosition);
    if (entity._conveyorVisited?.has(key)) {
      return { velocity: null };
    }

    const cfg = getConveyorConfig(tick.level, newPosition);

    return {
      velocity: convDir,
      sideEffect: (t) => {
        const e = t.entities.find((x) => x.kind === entity.kind && x.id === entity.id);
        if (!e) return;
        if (!e._conveyorVisited) e._conveyorVisited = new Set();
        e._conveyorVisited.add(key);
        // Overwrite any existing momentum with this conveyor's fresh n-step momentum
        e.momentum = { dir: convDir, stepsLeft: cfg.steps, totalSteps: cfg.steps };
        decrementConveyorUse(newPosition, t.level, t.conveyorRemainingUses);
      },
    };
  },
};
