import type { CellBehavior } from './registry';
import type { BehaviorResult } from '../engine/types';

/**
 * Ice: entity keeps its current velocity → slides until hitting a non-ice cell.
 *
 * The tick loop handles the "keep moving" semantics naturally — entity just
 * carries its velocity into the next tick. Lava edges kill as normal (no
 * special "lava is wall during ice" exception from the old engine).
 */
export const iceBehavior: CellBehavior = {
  onEnter(ctx): BehaviorResult {
    // Preserve incoming velocity → entity slides another step next tick.
    // If entity arrived with null velocity (e.g. teleporter with no momentum),
    // it stops here.
    return { velocity: ctx.entity.velocity };
  },
};
