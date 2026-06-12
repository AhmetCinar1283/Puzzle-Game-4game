import { CellBehavior, CellDef } from '../cellTypes';
import { Direction } from '../types';

export const directionDeflectorDef: CellDef = {
    friction: 1,
    isWalkable: true,
};

export const directionDeflectorBehavior: CellBehavior = {
    onEnter: (cell, entity) => {
        if (entity.physics.z > 0) return []; // Havadayken etki etmez
        if (entity.type !== 'player') return []; // Sadece player'ların yönlerini saptırır

        const currentMapping = (entity.customData.controlMapping as Record<Direction, Direction>) ?? {
            up: 'up', down: 'down', left: 'left', right: 'right'
        };
        const cellMapping = (cell.customData.mapping as Record<Direction, Direction>) ?? {
            up: 'up', down: 'down', left: 'left', right: 'right'
        };

        const newMapping: Record<Direction, Direction> = {
            up:    cellMapping[currentMapping.up]    ?? currentMapping.up,
            down:  cellMapping[currentMapping.down]  ?? currentMapping.down,
            left:  cellMapping[currentMapping.left]  ?? currentMapping.left,
            right: cellMapping[currentMapping.right] ?? currentMapping.right,
        };

        const newForce = entity.physics.force - cell.def.friction;

        return [{
            entityId: entity.id,
            type: 'mutate_entity',
            newForce: newForce < 0 ? 0 : newForce,
            customDataPatch: {
                controlMapping: newMapping
            }
        }];
    },
};
