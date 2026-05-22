// cells/trampolineCell.ts
// Trampolin: giren nesneyi belirli bir yönde fırlatır ve havaya kaldırır.

import { CellBehavior, CellDef } from '../cellTypes';
import { Direction, DIRECTION_DELTA } from '../types';

const TRAMPOLINE_FORCE  = 3;

export const trampolineDef: CellDef = {
    friction: 1,
    isWalkable: true,
};

export const trampolineBehavior: CellBehavior = {
    onEnter: (cell, entity, grid, entities) => {
        // Zaten havadaysa yeniden tetiklenme
        if (entity.physics.z > 0) return [];

        const direction = (cell.customData.direction as Direction) ?? 'up';
        const dr = DIRECTION_DELTA[direction].row;
        const dc = DIRECTION_DELTA[direction].col;

        const baseForce = (cell.customData.force as number) ?? TRAMPOLINE_FORCE;

        // Fırlatılacak yöndeki kareleri tarayıp en uzak yürünebilir/güvenli hedef kareyi bul
        let safeForce = 0;
        for (let d = baseForce; d >= 1; d--) {
            const targetPos = {
                row: cell.position.row + d * dr,
                col: cell.position.col + d * dc,
            };
            const targetCell = grid[targetPos.row]?.[targetPos.col];
            if (targetCell && targetCell.def.isWalkable) {
                safeForce = d;
                break;
            }
        }

        // Eğer hiçbir güvenli kare yoksa zıplama gerçekleşmesin (force ve Z sıfır)
        if (safeForce === 0) return [];

        return [{
            entityId: entity.id,
            type: 'mutate_entity',
            newDirection: direction,
            newForce: safeForce,
            newZ: safeForce,
            vfxTriggers: ['sound_boing', 'anim_stretch_up'],
        }];
    },
};
