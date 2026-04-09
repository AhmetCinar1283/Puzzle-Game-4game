import type { CellBehavior } from './registry';
import type { BehaviorResult } from '../engine/types';
import { cellTypeToLauncherDir } from '../positionUtils';
import { getLauncherConfig } from '../powerSystem';

/**
 * Launcher (catapult/trampoline): overrides any existing momentum and launches
 * the entity in the launcher's direction for N steps.
 *
 * Behaviour:
 *  - Applies to both players and boxes.
 *  - Cancels in-flight conveyor momentum immediately (full override).
 *  - Each launched step processes full physics: collisions, forbidden cells,
 *    other cell behaviors (chain to another conveyor/launcher, etc.).
 *  - If blocked mid-flight the remaining momentum is cleared (handled by
 *    the existing loop.ts momentum-clear logic on wall/obstacle/blocked push).
 */
export const launcherBehavior: CellBehavior = {
  onEnter(ctx): BehaviorResult {
    const { entity, newPosition, cellType, tick } = ctx;

    const launchDir = cellTypeToLauncherDir(cellType);
    if (!launchDir) return { velocity: null };

    const cfg = getLauncherConfig(tick.level, newPosition);

    return {
      velocity: launchDir,
      sideEffect: (t) => {
        const e = t.entities.find((x) => x.kind === entity.kind && x.id === entity.id);
        if (!e) return;
        // Replace any existing momentum with the launch momentum (no zProfile = ground-level).
        // stepsLeft = cfg.steps: the entity will travel cfg.steps cells total.
        e.momentum = { dir: launchDir, stepsLeft: cfg.steps, totalSteps: cfg.steps };
        e.z = 0; // launcher is ground-level
        // Clear cycle guard so the entity can freely pass through conveyors ahead.
        e._conveyorVisited = undefined;
      },
    };
  },
};
