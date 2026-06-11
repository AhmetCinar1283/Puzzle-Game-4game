// entities/boxEnt.ts

import { EntityBehavior } from '../entityTypes';
import { DIRECTION_DELTA, Direction } from '../types';

export const boxBehavior: EntityBehavior = {

    onTick: (self) => {
        const intents = [];

        // Buz veya konveyörden kazanılan force ile hareket
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

        // Yerçekimi: havadayken her tick bir kademe indir
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

    onPushed: (self, pusher, appliedForce, direction?: Direction) => {
        if (self.traits.has('heavy'))                           return { status: 'reject' };
        if (appliedForce <= 0)                                  return { status: 'reject' };
        if (self.customData.requiresPower && !self.customData.isPowered) return { status: 'reject' };

        // İtme yönü pozisyon farkından hesaplanır — pusher'ın physics.direction'ına
        // güvenilmez çünkü zincir iterken pusher başka yöne bakıyor olabilir.
        let dr = 0;
        let dc = 0;
        if (direction) {
            const delta = DIRECTION_DELTA[direction];
            dr = delta.row;
            dc = delta.col;
        } else {
            dr = self.position.row - pusher.position.row;
            dc = self.position.col - pusher.position.col;
        }
        return {
            status: 'accept',
            resultingIntent: {
                entityId: self.id,
                type: 'move' as const,
                targetPos: {
                    roomId: self.position.roomId,
                    row: self.position.row + dr,
                    col: self.position.col + dc,
                },
                force: appliedForce,
            },
            forceRemaining: appliedForce,
        };
    },

    onLanded: (_self, _entities) => [],
};
