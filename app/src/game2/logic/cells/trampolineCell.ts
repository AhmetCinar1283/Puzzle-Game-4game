// cells/trampolineCell.ts
// Trampolin: giren nesneyi belirli bir yönde fırlatır.
// Yön: cell.customData.direction (Direction)
// Verilen force ile nesne ileri fırlar; buz + trampolin kombinasyonu çok uzak gider.

import { CellBehavior, CellDef } from '../cellTypes';
import { Direction } from '../types';

const TRAMPOLINE_FORCE = 3;

export const trampolineDef: CellDef = {
    friction: 1,
    isWalkable: true,
};

export const trampolineBehavior: CellBehavior = {
    onEnter: (cell, entity) => {
        const direction = (cell.customData.direction as Direction) ?? 'up';

        return [{
            entityId: entity.id,
            type: 'mutate_entity',
            newDirection: direction,
            newForce: TRAMPOLINE_FORCE,
            vfxTriggers: ['sound_boing', 'anim_stretch_up'],
        }];
    },
};
