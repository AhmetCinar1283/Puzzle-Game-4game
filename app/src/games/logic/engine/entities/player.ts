import type { EntityBehavior, FinalizeContext, FinalizeResult, OnPushedResult, TickEntity, TickState } from '../types';
import { posEqual } from '../../positionUtils';

export const playerBehavior: EntityBehavior = {
  isUserControlled: true,
  participatesInOrderResolution: true,
  processingPriority: 0,
  isDestructible: false,
  generatesTrail: true,
  isPushChainRoot: false,

  onPushed(_self, _mover, _tick, _toRemove): OnPushedResult {
    return { outcome: 'mutual_stop' };
  },

  onLavaEdge(_self: TickEntity, tick: TickState): { halt: boolean } {
    tick.lostReason = 'lava_edge';
    return { halt: true };
  },

  onFinalize(ctx: FinalizeContext): FinalizeResult {
    const { tickEntity, prevState, tick } = ctx;
    const prevObj = prevState.objects.find((o) => o.id === tickEntity!.id);
    if (!prevObj || !tickEntity) return { kind: 'destroyed' }; // should never happen

    const target = tick.level.targets.find((t) => t.objectId === prevObj.id);
    const onTarget = target !== undefined && posEqual(tickEntity.position, target.position);
    const newIsLocked = prevObj.isLocked || (prevObj.lockOnTarget && onTarget);

    const state = {
      ...prevObj,
      position: tickEntity.position,
      mode: tickEntity.mode ?? prevObj.mode,
      isLocked: newIsLocked,
    };

    const moved = !posEqual(tickEntity.position, prevObj.position);
    const needsTrail =
      moved &&
      (tick.level.trailCollision || tick.poweredPlayers.includes(prevObj.id));

    return {
      kind: 'player_state',
      state,
      trailEntry: needsTrail ? prevObj.position : undefined,
    };
  },
};
