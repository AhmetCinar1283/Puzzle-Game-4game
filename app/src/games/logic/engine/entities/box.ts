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

    const m1 = mover.mass ?? 1;
    const m2 = self.mass ?? 1;
    const incoming = mover.force;

    // ── Elastik çarpışma (bilardo topu modeli) ───────────────────────────────
    // Eşit kütle: mover tüm kuvvetini box'a devreder, mover durur.
    // Farklı kütle: elastik formül.
    //   f2 (box'un aldığı) = incoming × 2m1 / (m1 + m2)
    //   f1' (mover'da kalan) = incoming × (m1 - m2) / (m1 + m2)
    const f2 = incoming * (2 * m1) / (m1 + m2);
    const f1after = incoming * (m1 - m2) / (m1 + m2);

    // Box'a gelen kuvveti ekle (önceki kuvveti varsa birleştir)
    self.pushedBy = mover;
    self.force += Math.max(0, f2);

    // Box yeterli kuvvete sahip mi? (force >= kendi mass)
    if (self.force < m2) {
      // Yetersiz kuvvet: box hareket etmiyor, kuvvet kayboldu
      self.force = 0;
      self.pushedBy = undefined;
      mover.force = 0; // mover da durdu
      return { outcome: 'push_blocked' };
    }

    // Box'u atomik olarak 1 adım ilerlet (Sokoban mekaniği: mover hücreye girer)
    const pushed = pushChainImmediately(self, vel, tick, toRemove);
    if (!pushed) {
      self.force = 0;
      self.pushedBy = undefined;
      mover.force = 0;
      return { outcome: 'push_blocked' };
    }

    // Mover'ın kalan kuvveti: f1after > 0 ise mover devam eder
    if (f1after <= 0) {
      mover.force = 0;
      // mover.velocity loop.ts tarafından push_succeeded'dan sonra korunur
      // ama force=0 olduğundan bir sonraki adım kontrolünde durur
    } else {
      mover.force = f1after;
    }

    return { outcome: 'push_succeeded' };
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
