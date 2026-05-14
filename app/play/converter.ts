// play/converter.ts
// StoredLevel (eski format) → game2 Entity[] + Cell[][] dönüşümü.
// Yalnızca play/ sayfasına özgü — game2 logic katmanı bunu bilmez.

import type { StoredLevel } from '@/app/src/lib/db';
import type { CellType }    from '@/app/src/games/types';
import type { Cell, CellTypes } from '@/app/src/game2/logic/cellTypes';
import type { Entity }          from '@/app/src/game2/logic/entityTypes';
import { CELL_DEFS }            from '@/app/src/game2/logic/cells/registry';
import type { Direction }       from '@/app/src/game2/logic/types';

// ============================================================
// ESKİ → YENİ HÜCRE TİPİ HARİTASI
// ============================================================

type CellMapping = {
    type: CellTypes;
    customData?: Record<string, unknown>;
};

function mapCellType(old: CellType): CellMapping {
    switch (old) {
        case 'empty':            return { type: 'normal' };
        case 'obstacle':         return { type: 'obstacle' };
        case 'forbidden':        return { type: 'forbidden' };
        case 'ice':              return { type: 'ice' };
        case 'power_node':       return { type: 'power' };
        case 'direction_toggle': return { type: 'toggle' };
        case 'target_1':         return { type: 'target',    customData: { playerIndex: 0 } };
        case 'target_2':         return { type: 'target',    customData: { playerIndex: 1 } };
        case 'conveyor_up':      return { type: 'conveyor',  customData: { direction: 'up'    as Direction } };
        case 'conveyor_down':    return { type: 'conveyor',  customData: { direction: 'down'  as Direction } };
        case 'conveyor_left':    return { type: 'conveyor',  customData: { direction: 'left'  as Direction } };
        case 'conveyor_right':   return { type: 'conveyor',  customData: { direction: 'right' as Direction } };
        case 'trampoline_up':    return { type: 'trampoline', customData: { direction: 'up'   as Direction } };
        case 'trampoline_down':  return { type: 'trampoline', customData: { direction: 'down' as Direction } };
        case 'trampoline_left':  return { type: 'trampoline', customData: { direction: 'left' as Direction } };
        case 'trampoline_right': return { type: 'trampoline', customData: { direction: 'right' as Direction } };
        case 'teleporter_in_A':  return { type: 'teleport', customData: { group: 'A', isIn: true  } };
        case 'teleporter_out_A': return { type: 'teleport', customData: { group: 'A', isIn: false } };
        case 'teleporter_in_B':  return { type: 'teleport', customData: { group: 'B', isIn: true  } };
        case 'teleporter_out_B': return { type: 'teleport', customData: { group: 'B', isIn: false } };
        case 'teleporter_in_C':  return { type: 'teleport', customData: { group: 'C', isIn: true  } };
        case 'teleporter_out_C': return { type: 'teleport', customData: { group: 'C', isIn: false } };
        default:                 return { type: 'normal' };
    }
}

// ============================================================
// ANA DÖNÜŞTÜRÜCÜ
// ============================================================

export interface Game2State {
    entities: Entity[];
    grid:     Cell[][];
}

export function convertToGame2State(stored: StoredLevel & { id: number }): Game2State {
    const rawGrid: CellType[][] =
        typeof stored.grid === 'string' ? JSON.parse(stored.grid) : stored.grid;

    // ── 1. ADIM: Hücre grid'ini oluştur ─────────────────────
    const grid: Cell[][] = rawGrid.map((row, rowIdx) =>
        row.map((oldType, colIdx) => {
            const { type, customData = {} } = mapCellType(oldType);
            return {
                id:           `${rowIdx}-${colIdx}`,
                type,
                position:     { row: rowIdx, col: colIdx },
                def:          { ...CELL_DEFS[type] },
                isElectrified: false,
                customData,
            };
        })
    );

    // ── 2. ADIM: Teleporter çiftlerini bağla ─────────────────
    // Her 'isIn' teleporter için aynı gruptaki 'isOut' hücresinin konumunu bul ve vice versa.
    const teleporters = grid.flat().filter(c => c.type === 'teleport');

    for (const inCell of teleporters.filter(c => c.customData.isIn === true)) {
        const group = inCell.customData.group as string;
        const outCell = teleporters.find(c => c.customData.group === group && c.customData.isIn === false);
        if (outCell) {
            inCell.customData.exitPos      = { ...outCell.position };
            outCell.customData.entrancePos = { ...inCell.position };
        }
    }

    // ── 3. ADIM: Entity'leri oluştur ─────────────────────────
    let nextId = 1;
    const entities: Entity[] = [];

    // Oyuncular — initialObjects sıralaması P1=0, P2=1
    for (let i = 0; i < stored.initialObjects.length; i++) {
        const obj = stored.initialObjects[i];
        entities.push({
            id:       nextId++,
            type:     'player',
            position: { ...obj.position },
            physics:  { direction: 'right', force: 0, z: 0 },
            def:      { mass: 1, resistance: 0, isSolid: true },
            traits:   new Set(['player_controlled', 'destructible']),
            isElectrified: false,
            customData: {
                playerIndex: i,
                mode:        obj.mode ?? 'normal',  // 'normal' | 'reversed'
            },
        });
    }

    // Kutular
    for (const box of stored.initialBoxes ?? []) {
        entities.push({
            id:       nextId++,
            type:     'box',
            position: { ...box.position },
            physics:  { direction: 'right', force: 0, z: 0 },
            def:      { mass: 2, resistance: 1, isSolid: true },
            traits:   new Set(['pushable', 'destructible']),
            isElectrified: false,
            customData: {
                requiresPower: box.requiresPower ?? false,
            },
        });
    }

    return { entities, grid };
}
