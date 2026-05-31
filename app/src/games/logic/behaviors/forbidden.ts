import type { CellBehavior } from './registry';
import type { BehaviorResult } from '../engine/types';

/**
 * Forbidden cell:
 *   - Player lands here → lostReason = 'forbidden', player stops
 *   - Box lands here    → box is silently destroyed
 *
 * No canEnter hook — forbidden cells are intentionally passable.
 * The game-over/destroy consequence fires in onEnter via sideEffect.
 * If entry were blocked by canEnter, the player would simply stop instead of losing.
 */
export const forbiddenBehavior: CellBehavior = {
  onEnter(ctx): BehaviorResult {
    if (!ctx.entity.behavior.isUserControlled) {
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
