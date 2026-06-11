// cells/trampolineCell.ts
// Trampolin: giren nesneyi belirli bir yönde fırlatır ve havaya kaldırır.

import { CellBehavior, CellDef } from '../cellTypes';
import { Direction, DIRECTION_DELTA } from '../types';
import { getNextTopologyPosition } from '../engine/getNextTopologyPosition';
import { getCellAt } from '../engine/rooms';

const TRAMPOLINE_FORCE  = 3;

export const trampolineDef: CellDef = {
    friction: 1,
    isWalkable: true,
};

export const trampolineBehavior: CellBehavior = {
    onEnter: (cell, entity, grid, entities, prevPos, levelBounds) => {
        // Zaten havadaysa yeniden tetiklenme
        if (entity.physics.z > 0) return [];

        const direction = (cell.customData.direction as Direction) ?? 'up';
        const baseForce = (cell.customData.force as number) ?? TRAMPOLINE_FORCE;

        // Fırlatılacak yöndeki kareleri tarayıp en uzak yürünebilir/güvenli hedef kareyi bul
        let safeForce = 0;

        if (levelBounds) {
            let currentPos = { ...cell.position };
            let hasLavaOrWall = false;
            let lastWalkableD = 0;

            // 1'den baseForce'a kadar adımları ileriye doğru simüle et
            for (let d = 1; d <= baseForce; d++) {
                const nextPos = getNextTopologyPosition(currentPos, direction, levelBounds);
                if (nextPos === 'wall') {
                    // Duvara çarptı, daha ileri gidemez
                    hasLavaOrWall = true;
                    break;
                } else if (nextPos === 'lava') {
                    // Lav hücresi: fırlatılmalı ve lavda ölmesi sağlanmalı!
                    safeForce = d;
                    hasLavaOrWall = true;
                    break;
                } else {
                    // Portal veya normal hücre (Position)
                    const targetCell = getCellAt(grid, nextPos);
                    if (targetCell) {
                        if (targetCell.def.isWalkable) {
                            lastWalkableD = d;
                        }
                        currentPos = nextPos;
                    } else {
                        // Grid dışı bilinmeyen durum (duvar gibi davran)
                        hasLavaOrWall = true;
                        break;
                    }
                }
            }

            if (!hasLavaOrWall) {
                // Eğer yol üstünde lav/duvar engeli yoksa, en uzak yürünebilir kareye fırlat
                safeForce = lastWalkableD;
            } else if (safeForce === 0) {
                // Eğer lav/duvar engeli varsa ve lav tetiklenmediyse (örneğin duvara çarptıysa),
                // en son geçtiği yürünebilir kareye fırlat
                safeForce = lastWalkableD;
            }
        } else {
            // Eğer levelBounds yoksa, eski klasik mantıkla (sarmalama ve kenar kuralları olmadan) tarama yap:
            const dr = DIRECTION_DELTA[direction].row;
            const dc = DIRECTION_DELTA[direction].col;
            for (let d = baseForce; d >= 1; d--) {
                const targetPos = {
                    roomId: cell.position.roomId,
                    row: cell.position.row + d * dr,
                    col: cell.position.col + d * dc,
                };
                const targetCell = getCellAt(grid, targetPos);
                if (targetCell && targetCell.def.isWalkable) {
                    safeForce = d;
                    break;
                }
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
