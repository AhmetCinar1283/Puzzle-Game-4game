// cells/forbiddenCell.ts
// Yasaklı hücre: giren entity yok edilir.

import { CellBehavior, CellDef } from '../cellTypes';

export const forbiddenDef: CellDef = {
    friction: 1,
    isWalkable: true,
};

export const forbiddenBehavior: CellBehavior = {
    onEnter: (cell, entity) => {
        if (entity.physics.z > 0) return []; // Havada — üzerinden geç

        if (entity.type === 'player') {
            return [
                {
                    entityId: entity.id,
                    type: 'destroy',
                    uiEvent: { kind: 'text', textType: 'error', message: 'Oyun bitti!' },
                },
                {
                    entityId: entity.id,
                    type: 'mutate_entity',
                    uiEvent: { kind: 'button', buttonType: 'restart', label: 'Yeniden Başla' },
                },
            ];
        }

        return [{ entityId: entity.id, type: 'destroy' }];
    },
};
