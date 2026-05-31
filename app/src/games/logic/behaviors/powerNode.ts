import type { CellBehavior } from './registry';
import type { BehaviorResult } from '../engine/types';

/**
 * Power node: stepping on this cell grants "powered" status to the player.
 * Powered players' trails act as electric cables for conveyor and box power.
 * Has no effect on boxes.
 */
export const powerNodeBehavior: CellBehavior = {
  onEnter(ctx): BehaviorResult {
    const { entity } = ctx;
    if (!entity.behavior.isUserControlled) return { velocity: null };

    return {
      velocity: null,
      sideEffect: (tick) => {
        if (!tick.poweredPlayers.includes(entity.id)) {
          tick.poweredPlayers = [...tick.poweredPlayers, entity.id];
        }
      },
    };
  },
};
