import type { CellBehavior } from './registry';
import type { BehaviorResult } from '../engine/types';

/**
 * Direction toggle: flips the landing player's movement mode (normal ↔ reversed).
 * Has no effect on boxes.
 */
export const directionToggleBehavior: CellBehavior = {
  onEnter(ctx): BehaviorResult {
    const { entity } = ctx;
    if (!entity.behavior.isUserControlled) return { velocity: null };

    return {
      velocity: null,
      sideEffect: (tick) => {
        const e = tick.entities.find((x) => x.behavior.isUserControlled && x.id === entity.id);
        if (!e) return;
        e.mode = e.mode === 'normal' ? 'reversed' : 'normal';
      },
    };
  },
};
