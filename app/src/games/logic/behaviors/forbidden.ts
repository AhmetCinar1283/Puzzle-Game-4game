import type { CellBehavior } from './registry';
import type { BehaviorResult } from '../engine/types';

/**
 * Forbidden cell:
 *   - Player lands here → lostReason = 'forbidden', player stops
 *   - Box lands here    → box is silently destroyed
 */
export const forbiddenBehavior: CellBehavior = {
  onEnter(ctx): BehaviorResult {
    if (ctx.entity.kind === 'box') {
      return { velocity: null, destroyEntity: true };
    }

    // Player: mark loss via side effect (applied after all entities in this tick)
    return {
      velocity: null,
      sideEffect: (tick) => {
        if (!tick.lostReason) tick.lostReason = 'forbidden';
      },
    };
  },
};
