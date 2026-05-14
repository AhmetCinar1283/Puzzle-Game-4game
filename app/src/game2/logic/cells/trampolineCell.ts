// cells/trampolineCell.ts
// Trampolin: giren nesneyi belirli bir yönde fırlatır ve havaya kaldırır.

import { CellBehavior, CellDef } from '../cellTypes';
import { Direction } from '../types';

const TRAMPOLINE_FORCE  = 3;
const TRAMPOLINE_HEIGHT = 3; // Zıpladığında ulaşılan z yüksekliği

export const trampolineDef: CellDef = {
    friction: 1,
    isWalkable: true,
};

export const trampolineBehavior: CellBehavior = {
    onEnter: (cell, entity) => {
        // Zaten havadaysa yeniden tetiklenme
        if (entity.physics.z > 0) return [];

        const direction = (cell.customData.direction as Direction) ?? 'up';

        return [{
            entityId: entity.id,
            type: 'mutate_entity',
            newDirection: direction,
            newForce: TRAMPOLINE_FORCE,
            newZ: TRAMPOLINE_HEIGHT,
            vfxTriggers: ['sound_boing', 'anim_stretch_up'],
        }];
    },
};
