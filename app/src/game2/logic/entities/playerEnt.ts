// entities/playerEnt.ts
// Oyuncunun tepkisel davranışları.
// KURAL: Bu dosya matematik yapar — ama motor yapmaz.

import { EntityBehavior } from '../entityTypes';
import { DIRECTION_DELTA } from '../types';

export const playerBehavior: EntityBehavior = {

    // Her tick'te: eğer force > 0 ise mevcut yönde hareket et.
    // Force'u hücrenin onEnter hook'u ayarlar; oyuncu burada sadece "kullanır".
    onTick: (self) => {
        if (self.physics.force <= 0) return [];

        const delta = DIRECTION_DELTA[self.physics.direction];
        return [{
            entityId: self.id,
            type: 'move',
            targetPos: {
                row: self.position.row + delta.row,
                col: self.position.col + delta.col,
            },
            force: self.physics.force,
        }];
    },

    // Oyuncular itilemez — reddet.
    onPushed: (_self, _pusher, _appliedForce) => {
        return { status: 'reject' };
    },

    // Trampolinden veya düşüşten sonra yere inerken.
    // Şimdilik ek niyet üretmiyor; ileride ezilme kontrolü buraya eklenir.
    onLanded: (_self) => {
        return [];
    },
};
