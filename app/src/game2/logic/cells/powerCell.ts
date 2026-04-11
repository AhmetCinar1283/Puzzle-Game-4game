// cells/powerCell.ts
// Güç noktası: üzerine basan oyuncuyu "elektrikli" yapar.
// Elektrikli oyuncunun iz'i elektrik kablosu işlevi görür.

import { CellBehavior, CellDef } from '../cellTypes';

export const powerDef: CellDef = {
    friction: 1,
    isWalkable: true,
};

export const powerBehavior: CellBehavior = {
    onEnter: (_cell, entity) => [{
        entityId: entity.id,
        type: 'mutate_entity',
        newElectrifiedState: true,
    }],
};
