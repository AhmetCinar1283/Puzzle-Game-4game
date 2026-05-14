// cells/targetCell.ts
// Hedef hücre: oyuncunun ulaşması gereken bitiş noktası.

import { CellBehavior, CellDef } from '../cellTypes';

export const targetDef: CellDef = {
    friction:   1,
    isWalkable: true,
};

export const targetBehavior: CellBehavior = {
    onEnter: (cell, entity) => {
        if (entity.physics.z > 0) return []; // Havada — sürtünme uygulanmaz

        const newForce = entity.physics.force - cell.def.friction;
        return [{
            entityId: entity.id,
            type: 'mutate_entity',
            newForce: newForce < 0 ? 0 : newForce,
        }];
    },
};
