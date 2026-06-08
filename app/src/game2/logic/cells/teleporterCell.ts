// cells/teleporterCell.ts
// Işınlayıcı: giren nesneyi eşleşen çıkışa taşır.
// Hız korunur. Çıkış doluysa motor move'u reddeder.
//
// customData:
//   group: 'A' | 'B' | 'C'
//   isIn: boolean           — true = giriş, false = çıkış
//   exitPos?: Position      — giriş hücresi için çıkış konumu
//   entrancePos?: Position  — çıkış hücresi için giriş konumu

import { CellBehavior, CellDef } from '../cellTypes';
import { Position } from '../types';

export const teleportDef: CellDef = {
    friction: 0,
    isWalkable: true,
};

export const teleportBehavior: CellBehavior = {
    onEnter: (cell, entity, grid, entities, prevPos) => {
        if (entity.physics.z > 0) return []; // Havada — ışınlanma yok

        const targetPos = cell.customData.targetPos as Position | undefined;
        if (!targetPos) return [];

        // Eğer bir önceki pozisyon hedeflenen ışınlanma çıkış noktası ile aynıysa, 
        // bu nesne yeni ışınlanmıştır. Sonsuz döngüyü önlemek için tekrar ışınlamıyoruz.
        if (prevPos && prevPos.row === targetPos.row && prevPos.col === targetPos.col) {
            return [];
        }

        return [{
            entityId: entity.id,
            type: 'move',
            targetPos: targetPos,
            force: entity.physics.force,
            vfxTriggers: ['sound_portal_enter', 'sound_portal_exit'],
        }];
    },
};
