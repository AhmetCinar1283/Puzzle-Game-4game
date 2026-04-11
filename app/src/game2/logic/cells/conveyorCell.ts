// cells/conveyorCell.ts
// Konveyör bandı: üzerindeki nesneyi kendi yönünde fırlatır.
// Hem yeni giren (onEnter) hem de orada duran (onTick) nesnelere hız verir.
// Yön: cell.customData.direction (Direction)

import { CellBehavior, CellDef } from '../cellTypes';
import { Direction } from '../types';

// Konveyörün verdiği force miktarı
const CONVEYOR_FORCE = 3;

export const conveyorDef: CellDef = {
    friction: 0,     // Konveyör kendi force'unu veriyor; zemin sürtünmesi uygulanmaz
    isWalkable: true,
};

export const conveyorBehavior: CellBehavior = {

    // Üzerine girdiğinde: konveyör yönünde force ver.
    onEnter: (cell, entity) => {
        const direction = cell.customData.direction as Direction;
        return [{
            entityId: entity.id,
            type: 'mutate_entity',
            newDirection: direction,
            newForce: CONVEYOR_FORCE,
        }];
    },

    // Her tick'te: hâlâ bu karenin üzerinde ve duruyorsa (force=0) yeniden itmek için.
    // Bu sayede nesne konveyörün üzerine başka bir yönden durmuşsa da taşınır.
    onTick: (cell, entities) => {
        const entityOnCell = entities.find(e =>
            e.position.row === cell.position.row &&
            e.position.col === cell.position.col &&
            e.physics.force === 0        // Sadece duruyorsa — hareket halindeyken onEnter zaten verdim
        );

        if (!entityOnCell) return [];

        const direction = cell.customData.direction as Direction;
        return [{
            entityId: entityOnCell.id,
            type: 'mutate_entity',
            newDirection: direction,
            newForce: CONVEYOR_FORCE,
        }];
    },
};
