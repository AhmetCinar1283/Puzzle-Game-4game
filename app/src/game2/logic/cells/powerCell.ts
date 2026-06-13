import { CellBehavior, CellDef } from '../cellTypes';

export const powerDef: CellDef = {
    friction: 1,
    isWalkable: true,
};

export const powerBehavior: CellBehavior = {
    onEnter: (cell, entity) => {
        if (entity.physics.z > 0) return []; // Havada — güç aktarılmaz

        const newForce = entity.physics.force - cell.def.friction;
        return [{
            entityId: entity.id,
            type: 'mutate_entity',
            newElectrifiedState: true,
            newForce: newForce < 0 ? 0 : newForce,
        }];
    },
    onLeave: (_cell, entity) => {
        // If player is holding cable, they stay electrified when leaving power cell
        if (entity.type === 'player' && entity.customData.holdingCable) {
            return [];
        }
        return [{
            entityId: entity.id,
            type: 'mutate_entity',
            newElectrifiedState: false,
        }];
    },
};
