// cells/conveyorCell.ts
// Konveyör bandı: üzerindeki nesneyi belirli yönde iter.

import { CellBehavior, CellDef } from '../cellTypes';
import { Direction } from '../types';

const CONVEYOR_FORCE = 3;

export const conveyorDef: CellDef = {
    friction: 0,
    isWalkable: true,
};

export const conveyorBehavior: CellBehavior = {

    onEnter: (cell, entity) => {
        if (entity.physics.z > 0) return []; // Havada — konveyör etkisi yok

        const direction = cell.customData.direction as Direction;
        return [{
            entityId: entity.id,
            type: 'mutate_entity',
            newDirection: direction,
            newForce: CONVEYOR_FORCE,
        }];
    },

    // Üzerinde duruyorsa (force=0) yeniden itmek için
    onTick: (cell, entities) => {
        const entityOnCell = entities.find(e =>
            e.position.row === cell.position.row &&
            e.position.col === cell.position.col &&
            e.physics.force === 0 &&
            e.physics.z === 0  // Havadaki entity'ye konveyör uygulanmaz
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
