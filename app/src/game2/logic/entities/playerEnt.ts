// entities/playerEnt.ts

import { EntityBehavior } from '../entityTypes';
import { DIRECTION_DELTA } from '../types';

export const playerBehavior: EntityBehavior = {

    onTick: (self) => {
        const intents: any[] = [];

        // If player is locked, they generate absolutely no movement intents.
        if (self.customData.isLocked) {
            return [];
        }

        // Hareket: force > 0 ise mevcut yönde bir adım at
        if (self.physics.force > 0) {
            const delta = DIRECTION_DELTA[self.physics.direction];
            intents.push({
                entityId: self.id,
                type: 'move' as const,
                targetPos: {
                    roomId: self.position.roomId,
                    row: self.position.row + delta.row,
                    col: self.position.col + delta.col,
                },
                force: self.physics.force,
            });
        }

        // Yerçekimi: z > 0 ise her tick'te bir indir; sıfıra gelince landing tetikle
        if (self.physics.z > 0) {
            const newZ = self.physics.z - 1;
            intents.push({
                entityId: self.id,
                type: 'fall' as const,
                newZ,
                triggerLanded: newZ === 0,
            });
        }

        return intents;
    },

    // Oyuncular itilemez
    onPushed: () => ({ status: 'reject' }),

    // İniş mantığı (ezme, obstacle kırma) motorda (intentLoop) işlenir.
    onLanded: () => [],
};
