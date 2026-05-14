// cells/iceCell.ts
// Buz: sürtünmesiz zemin — nesne kayar.
// Ağır bir nesne üzerine düşerse kırılır.

import { CellBehavior, CellDef } from '../cellTypes';

export const iceDef: CellDef = {
    friction: 0,
    durability: 1,
    isWalkable: true,
};

export const iceBehavior: CellBehavior = {

    onEnter: (cell, entity) => {
        if (entity.physics.z > 0) return []; // Havada — buz etkisi yok

        return [{
            entityId: entity.id,
            type: 'mutate_entity',
            newForce: entity.physics.force, // Sürtünme yok → force değişmez
        }];
    },

    // Ağır bir şey düşerse normal hücreye dönüşür
    onImpact: (cell, fallingEntity) => {
        if (fallingEntity.def.mass >= (cell.def.durability ?? 99)) {
            return [{
                entityId: fallingEntity.id,
                type: 'mutate_cell',
                targetCellPos: cell.position,
                newCellType: 'normal',
                vfxTriggers: ['sound_ice_break'],
            }];
        }
        return [];
    },
};
