// cells/toggleCell.ts
// Yön değiştirici: nesnenin hareket algısını tersine çevirir (Normal ↔ Ters).
// Oyun kontrolcüsü entity.customData.mode'u okuyarak girdi yönünü belirler.

import { CellBehavior, CellDef } from '../cellTypes';

export const toggleDef: CellDef = {
    friction: 1,
    isWalkable: true,
};

export const toggleBehavior: CellBehavior = {
    onEnter: (_cell, entity) => {
        const currentMode = (entity.customData.mode as 'normal' | 'reversed') ?? 'normal';
        const newMode = currentMode === 'normal' ? 'reversed' : 'normal';

        return [{
            entityId: entity.id,
            type: 'mutate_entity',
            customDataPatch: { mode: newMode },
        }];
    },
};
