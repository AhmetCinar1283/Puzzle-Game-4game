// cells/powerCell.ts
// Güç noktası: üzerine basan entity'yi elektrikli yapar.

import { CellBehavior, CellDef } from '../cellTypes';

export const powerDef: CellDef = {
    friction: 1,
    isWalkable: true,
};

export const powerBehavior: CellBehavior = {
    onEnter: (_cell, entity) => {
        if (entity.physics.z > 0) return []; // Havada — güç aktarılmaz

        return [{
            entityId: entity.id,
            type: 'mutate_entity',
            newElectrifiedState: true,
        }];
    },
};
