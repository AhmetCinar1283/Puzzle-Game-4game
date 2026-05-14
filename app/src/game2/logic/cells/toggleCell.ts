// cells/toggleCell.ts
// Yön değiştirici: nesnenin hareket modunu tersine çevirir (normal ↔ reversed).

import { CellBehavior, CellDef } from '../cellTypes';

export const toggleDef: CellDef = {
    friction: 1,
    isWalkable: true,
};

export const toggleBehavior: CellBehavior = {
    onEnter: (_cell, entity) => {
        if (entity.physics.z > 0) return []; // Havada — toggle tetiklenme

        const currentMode = (entity.customData.mode as 'normal' | 'reversed') ?? 'normal';
        const newMode = currentMode === 'normal' ? 'reversed' : 'normal';

        return [{
            entityId: entity.id,
            type: 'mutate_entity',
            customDataPatch: { mode: newMode },
        }];
    },
};
