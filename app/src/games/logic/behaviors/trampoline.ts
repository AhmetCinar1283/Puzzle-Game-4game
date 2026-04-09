import type { CellBehavior } from './registry';
import type { BehaviorResult } from '../engine/types';
import { cellTypeToTrampolineDir } from '../positionUtils';
import { getTrampolineConfig } from '../powerSystem';

/**
 * Trampoline: gives the entity an airborne momentum arc.
 *
 * Instead of the old instant-teleport (jumpTo), the entity now travels step by
 * step through cfg.steps cells, with a parabolic z-profile that makes it fly
 * over obstacles, lava edges, and other entities.
 *
 * Z-profile shape: rises quickly, peaks, then descends — last step always z=0
 * (landing). The loop's crush-on-landing logic handles entities at the landing
 * cell when z transitions from > 0 to 0.
 *
 *   Example for 5 steps: [2, 4, 4, 2, 0]
 *     step 0 → z=2 (lift-off)
 *     step 1 → z=4 (ascending)
 *     step 2 → z=4 (peak)
 *     step 3 → z=2 (descending)
 *     step 4 → z=0 (landing — crush check fires in loop)
 *
 * Key differences from Launcher:
 *  - Has a zProfile → entity is truly "airborne" mid-flight.
 *  - Intermediate cells are skipped (no cell behaviors, no occupancy).
 *  - At landing (z=0 step): crush logic applies.
 *  - If entity runs out of steps at a wall/edge: stops and lands there.
 */
export const trampolineBehavior: CellBehavior = {
  onEnter(ctx): BehaviorResult {
    const { entity, newPosition, cellType, tick } = ctx;

    const launchDir = cellTypeToTrampolineDir(cellType);
    if (!launchDir) return { velocity: null };

    const cfg = getTrampolineConfig(tick.level, newPosition);
    const steps = cfg.steps;

    // Build a parabolic z-profile: rises to a peak, lands at z=0.
    // Profile length = steps. Last entry is always 0 (landing).
    const zProfile = buildZProfile(steps);

    return {
      velocity: launchDir,
      sideEffect: (t) => {
        const e = t.entities.find((x) => x.kind === entity.kind && x.id === entity.id);
        if (!e) return;
        e.momentum = {
          dir: launchDir,
          stepsLeft: steps,
          totalSteps: steps,
          zProfile,
        };
        // Clear conveyor cycle guard — entity can be caught by conveyors after landing.
        e._conveyorVisited = undefined;
      },
    };
  },
};

/**
 * Builds a parabolic z-profile for `steps` movement steps.
 * Always ends at z=0 (landing). Peak is in the middle.
 *
 * Examples:
 *   steps=1 → [0]                       (tiny hop, direct landing)
 *   steps=2 → [2, 0]
 *   steps=3 → [2, 2, 0]
 *   steps=5 → [2, 4, 4, 2, 0]
 */
function buildZProfile(steps: number): number[] {
  if (steps <= 0) return [];
  if (steps === 1) return [0];

  const profile: number[] = [];
  const peak = steps <= 3 ? 2 : 4;
  const peakIdx = Math.floor((steps - 1) / 2);

  for (let i = 0; i < steps; i++) {
    if (i === steps - 1) {
      profile.push(0); // always land at z=0
    } else {
      // Parabolic shape: rises to peak at peakIdx, symmetric descent
      const distFromPeak = Math.abs(i - peakIdx);
      const maxDist = Math.max(peakIdx, steps - 2 - peakIdx);
      const t = maxDist > 0 ? 1 - distFromPeak / maxDist : 1;
      profile.push(Math.round(peak * t));
    }
  }

  return profile;
}
