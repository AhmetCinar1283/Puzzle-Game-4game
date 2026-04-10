import type { CellBehavior } from './registry';
import type { BehaviorResult } from '../engine/types';

/**
 * Ice: sürtünmesizdir — entity her adımda force kaybetmez.
 *
 * frictionless: true → engine bu hücrede force -= 0 uygular.
 * Bu sayede:
 *   - Conveyor ile gelen entity buz üzerinde tüm kuvvetini korur.
 *   - Buz üzerinde hareket eden entity buz biter, normal zemine geçince
 *     kalan kuvvetiyle devam eder (eski sistemde anında duruyordu).
 *   - Trampolinle gelen entity buzda iner: force * 0.5 kalır, sürüşmeye devam eder.
 *
 * onEnter: gelen velocity'yi korur (entity kaymayı sürdürür).
 * Eğer entity null velocity ile geliyorsa (ör. teleporter), burada durur.
 */
export const iceBehavior: CellBehavior = {
  frictionless: true,

  onEnter(ctx): BehaviorResult {
    // Preserve incoming velocity → entity slides another step next tick.
    return { velocity: ctx.entity.velocity };
  },
};
