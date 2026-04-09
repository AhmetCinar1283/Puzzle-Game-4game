import type { EntityBehavior, FinalizeContext, FinalizeResult, OnPushedResult, TickEntity, TickState } from '../types';
import { pushChainImmediately } from '../collision';

export const boxBehavior: EntityBehavior = {
  isUserControlled: false,
  participatesInOrderResolution: false,
  processingPriority: 1,
  isDestructible: true,
  generatesTrail: false,
  isPushChainRoot: true,

  onPushed(self: TickEntity, mover: TickEntity, tick: TickState, toRemove: Set<TickEntity>): OnPushedResult {
    if (self.velocity !== null) return { outcome: 'occupant_moving' };
    const vel = mover.velocity;
    if (!vel) return { outcome: 'push_blocked' };
    const pushed = pushChainImmediately(self, vel, tick, toRemove);
    return pushed ? { outcome: 'push_succeeded' } : { outcome: 'push_blocked' };
  },

  onLavaEdge(self: TickEntity, _tick: TickState, toRemove: Set<TickEntity>): { halt: boolean } {
    toRemove.add(self);
    return { halt: false };
  },

  onFinalize(ctx: FinalizeContext): FinalizeResult {
    const { tickEntity, prevState } = ctx;
    if (!tickEntity) return { kind: 'destroyed' };
    const prevBox = prevState.boxes.find((b) => b.id === tickEntity.id);
    if (!prevBox) return { kind: 'destroyed' };
    return { kind: 'box_state', state: { ...prevBox, position: tickEntity.position } };
  },
};
