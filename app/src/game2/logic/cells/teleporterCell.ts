// cells/teleporterCell.ts
// Işınlayıcı: giren nesneyi eşleşen çıkışa taşır.
// Çıkış doluysa motor move'u reddeder → ışınlanma gerçekleşmez.
// Hız korunur: nesne çıkışta da aynı force ile devam eder.
//
// customData şeması:
//   group: 'A' | 'B' | 'C'          — hangi ışınlayıcı grubu
//   isIn: boolean                    — giriş mi (true) yoksa çıkış mı (false)
//   exitPos?: Position               — giriş hücresi için eşleşen çıkış konumu
//   entrancePos?: Position           — çıkış hücresi için eşleşen giriş konumu

import { CellBehavior, CellDef } from '../cellTypes';
import { Position } from '../types';

export const teleportDef: CellDef = {
    friction: 0,     // Hız korunur — çıkışta normal zemin zaten durduracak
    isWalkable: true,
};

export const teleportBehavior: CellBehavior = {
    onEnter: (cell, entity) => {
        const isIn = cell.customData.isIn as boolean ?? true;

        if (isIn) {
            // Giriş hücresi: çıkışa ışınla
            const exitPos = cell.customData.exitPos as Position | undefined;
            if (!exitPos) return []; // Eşleşen çıkış yoksa hiçbir şey yapma

            return [{
                entityId: entity.id,
                type: 'move',
                targetPos: exitPos,
                force: entity.physics.force, // Hızı taşı
            }];
        } else {
            // Çıkış hücresi: tersine ışınla (çıkıştan girişe adım atılırsa)
            const entrancePos = cell.customData.entrancePos as Position | undefined;
            if (!entrancePos) return [];

            return [{
                entityId: entity.id,
                type: 'move',
                targetPos: entrancePos,
                force: entity.physics.force,
            }];
        }
    },
};
