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
        const intents: any[] = [{
            entityId: entity.id,
            type: 'mutate_entity',
            newForce: newForce < 0 ? 0 : newForce,
        }];

        // Modular Target Locking
        if (entity.type === 'player') {
            const playerIndex = (entity.customData.playerIndex as number) ?? 0;
            const targetPlayerIndex = (cell.customData.playerIndex as number) ?? 0;
            if (playerIndex === targetPlayerIndex && entity.customData.lockOnTarget) {
                intents.push({
                    entityId: entity.id,
                    type: 'mutate_entity',
                    customDataPatch: { isLocked: true },
                    newForce: 0,
                });
            }
        }

        return intents;
    },
};
