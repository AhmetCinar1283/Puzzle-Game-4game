// entities/boxEnt.ts
// Kutunun tepkisel davranışları.
// KURAL: Bu dosya matematik yapar — ama motor yapmaz.

import { EntityBehavior } from '../entityTypes';
import { DIRECTION_DELTA } from '../types';

export const boxBehavior: EntityBehavior = {

    // Buz veya konveyör gibi hücrelerden force kazanan kutu devam eder.
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

    // Birisi kutuyu itmeye çalıştığında:
    onPushed: (self, pusher, appliedForce) => {
        // "heavy" özelliği: asla itilemez
        if (self.traits.has('heavy')) {
            return { status: 'reject' };
        }

        // Güç yok: itilemez
        if (appliedForce <= 0) {
            return { status: 'reject' };
        }

        // "requiresPower" özel kuralı: hücre elektrikli değilse itilemez.
        // Bu kontrolü hücrenin onValidateIntent hook'u da yapabilir;
        // burası "kutu kendi kendini reddediyor" durumu için yedek kontrol.
        if (self.customData.requiresPower && !self.customData.isPowered) {
            return { status: 'reject' };
        }

        // Normal kutu: iticinin yönünde hareket eder.
        const delta = DIRECTION_DELTA[pusher.physics.direction];
        return {
            status: 'accept',
            resultingIntent: {
                entityId: self.id,
                type: 'move',
                targetPos: {
                    row: self.position.row + delta.row,
                    col: self.position.col + delta.col,
                },
                force: appliedForce,
            },
            // İten kişi tüm force'u korur — iten hedefe girer.
            forceRemaining: appliedForce,
        };
    },

    // Üzerine bir şey düştüğünde (trampolin yerleşimi vb.)
    onLanded: (_self) => {
        return [];
    },
};
