// cells/iceCell.ts
// Buz: sürtünmesiz zemin — her adımda force tüketilmez, nesne kayar.
// Ağır bir nesne üzerine düşerse kırılır (normal hücreye dönüşür).

import { CellBehavior, CellDef } from '../cellTypes';

export const iceDef: CellDef = {
    friction: 0,     // Sürtünme yok — force tükenmez
    durability: 1,   // 1+ kütleli nesne düşerse kırılır
    isWalkable: true,
};

export const iceBehavior: CellBehavior = {

    // Buz üzerine girildiğinde: hücre, force'u olduğu gibi korur.
    // Motor değil, BUZ hücresi bu kararı verir.
    onEnter: (cell, entity) => [{
        entityId: entity.id,
        type: 'mutate_entity',
        newForce: entity.physics.force, // Sürtünme yok → force değişmez
    }],

    // Ağır bir şey düşerse: kendini normal hücreye çevirir.
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
