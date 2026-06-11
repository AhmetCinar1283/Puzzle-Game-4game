// cells/controlSwitchCell.ts
// Kontrol değiştirici hücre: üzerine basıldığında aktif olan / yönlendirilen odaları değiştirir.

import { CellBehavior, CellDef } from '../cellTypes';

export const controlSwitchDef: CellDef = {
    friction: 1,
    isWalkable: true,
};

export const controlSwitchBehavior: CellBehavior = {
    onEnter: (cell, entity) => {
        if (entity.physics.z > 0) return []; // Havadayken etki etmez

        const action = (cell.customData.action as 'set' | 'toggle' | 'cycle' | 'add' | 'remove') ?? 'cycle';
        const targetRooms = (cell.customData.targetRooms as string[]) ?? [];

        return [{
            entityId: entity.id,
            type: 'mutate_entity', // Durum değişikliği niyetini tetikle
            uiEvent: {
                kind: 'change_control',
                action,
                targetRooms,
            },
        }];
    },
};
