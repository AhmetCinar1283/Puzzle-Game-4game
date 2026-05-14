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
    onEnter: (cell, entity) => {
        if (entity.physics.z > 0) return []; // Havada — ışınlanma yok

        const isIn = (cell.customData.isIn as boolean) ?? true;

        if (!isIn) return []; // Çıkış hücresi — sadece iniş noktası, geri göndermez

        const exitPos = cell.customData.exitPos as Position | undefined;
        if (!exitPos) return [];

        return [{
            entityId: entity.id,
            type: 'move',
            targetPos: exitPos,
            force: entity.physics.force,
        }];
    },
};
