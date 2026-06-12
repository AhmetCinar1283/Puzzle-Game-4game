// app/src/game2/logic/converter.ts
// StoredLevel (eski/yeni format) → game2 Entity[] + rooms: Record<string, RoomState> dönüşümü.
// Paylaşılan mantık (Shared logic) katmanındadır. Hem istemci (frontend) hem worker kullanır.

import type { StoredLevel } from '../../lib/db';
import type { CellType }    from '../../games/types';
import type { Cell, CellTypes } from './cellTypes';
import type { Entity }          from './entityTypes';
import { CELL_DEFS }            from './cells/registry';
import type { Direction, RoomState } from './types';

// ============================================================
// ESKİ → YENİ HÜCRE TİPİ HARİTASI
// ============================================================

type CellMapping = {
    type: CellTypes;
    customData?: Record<string, unknown>;
};

function mapCellType(old: string): CellMapping {
    if (old.startsWith('target_')) {
        const numStr = old.substring('target_'.length);
        const playerIndex = parseInt(numStr, 10) - 1;
        if (!isNaN(playerIndex)) {
            return { type: 'target', customData: { playerIndex } };
        }
    }
    if (old.startsWith('teleporter_in_')) {
        const group = old.substring('teleporter_in_'.length);
        return { type: 'teleport', customData: { group } };
    }
    if (old.startsWith('teleporter_out_')) {
        const group = old.substring('teleporter_out_'.length);
        return { type: 'teleport', customData: { group } };
    }

    switch (old) {
        case 'empty':            return { type: 'normal' };
        case 'obstacle':         return { type: 'obstacle' };
        case 'forbidden':        return { type: 'forbidden' };
        case 'ice':              return { type: 'ice' };
        case 'power_node':       return { type: 'power' };
        case 'direction_toggle': return { type: 'toggle' };
        case 'direction_deflector': return { type: 'direction_deflector' };
        case 'conveyor_up':      return { type: 'conveyor',  customData: { direction: 'up'    as Direction } };
        case 'conveyor_down':    return { type: 'conveyor',  customData: { direction: 'down'  as Direction } };
        case 'conveyor_left':    return { type: 'conveyor',  customData: { direction: 'left'  as Direction } };
        case 'conveyor_right':   return { type: 'conveyor',  customData: { direction: 'right' as Direction } };
        case 'trampoline_up':    return { type: 'trampoline', customData: { direction: 'up'   as Direction } };
        case 'trampoline_down':  return { type: 'trampoline', customData: { direction: 'down' as Direction } };
        case 'trampoline_left':  return { type: 'trampoline', customData: { direction: 'left' as Direction } };
        case 'trampoline_right': return { type: 'trampoline', customData: { direction: 'right' as Direction } };
        default:                 return { type: 'normal' };
    }
}

// ============================================================
// ANA DÖNÜŞTÜRÜCÜ
// ============================================================

export interface Game2State {
    entities: Entity[];
    rooms: Record<string, RoomState>;
    controlMode: 'all_rooms' | 'selected_room';
    initialControlledRooms: string[];
}

export function convertToGame2State(stored: StoredLevel & { id: number }): Game2State {
    const controlMode = stored.controlMode ?? 'all_rooms';
    const rooms: Record<string, RoomState> = {};

    // ── 1. ADIM: Odaları oluştur ─────────────────────────
    if (stored.rooms && stored.rooms.length > 0) {
        // Yeni format: Çoklu oda desteği var
        for (const rDef of stored.rooms) {
            const rawGrid: any[][] =
                typeof rDef.grid === 'string' ? JSON.parse(rDef.grid) : rDef.grid;

            const grid: Cell[][] = rawGrid.map((row, rowIdx) =>
                row.map((oldType, colIdx) => {
                    const { type, customData = {} } = mapCellType(oldType);

                    // Özel trambolin adımlarını customData.force'a eşle
                    const trampCfg = stored.trampolineConfig?.find(
                        cfg => cfg.position.roomId === rDef.id && cfg.position.row === rowIdx && cfg.position.col === colIdx
                    );
                    if (trampCfg) {
                        customData.force = trampCfg.steps;
                    }

                    // control_switch custom data eşleşmesi
                    if (type === 'control_switch' && oldType.startsWith('control_switch_')) {
                        // format: control_switch_[action]_[targetRoomsCsv]
                        // örn: control_switch_toggle_room_1,room_2
                        const parts = oldType.split('_');
                        if (parts.length >= 4) {
                            customData.action = parts[2];
                            customData.targetRooms = parts[3].split(',');
                        }
                    }

                    // direction_deflector custom data eşleşmesi
                    const defCfg = stored.deflectorConfig?.find(
                        cfg => cfg.position.roomId === rDef.id && cfg.position.row === rowIdx && cfg.position.col === colIdx
                    );
                    if (type === 'direction_deflector') {
                        customData.mapping = defCfg?.mapping ?? { up: 'right', right: 'down', down: 'left', left: 'up' };
                    }

                    return {
                        id:           `${rDef.id}-${rowIdx}-${colIdx}`,
                        type,
                        position:     { roomId: rDef.id, row: rowIdx, col: colIdx },
                        def:          { ...CELL_DEFS[type] },
                        isElectrified: false,
                        customData,
                    };
                })
            );

            rooms[rDef.id] = {
                id: rDef.id,
                name: rDef.name,
                width: rDef.width,
                height: rDef.height,
                x: rDef.x ?? 0,
                y: rDef.y ?? 0,
                edges: rDef.edges,
                grid,
                fogOfWar: rDef.fogOfWar ?? false,
                fogVisibilityDistance: rDef.fogVisibilityDistance ?? 1.5,
                fogKeepRevealed: rDef.fogKeepRevealed ?? true,
            };
        }
    } else {
        // Eski format: Tek oda fallback
        const roomId = 'main';
        const rawGrid: any[][] =
            typeof stored.grid === 'string' ? JSON.parse(stored.grid) : stored.grid;

        const grid: Cell[][] = rawGrid.map((row, rowIdx) =>
            row.map((oldType, colIdx) => {
                const { type, customData = {} } = mapCellType(oldType);

                const trampCfg = stored.trampolineConfig?.find(
                    cfg => (!cfg.position.roomId || cfg.position.roomId === roomId) && cfg.position.row === rowIdx && cfg.position.col === colIdx
                );
                if (trampCfg) {
                    customData.force = trampCfg.steps;
                }

                // direction_deflector custom data eşleşmesi
                const defCfg = stored.deflectorConfig?.find(
                    cfg => (!cfg.position.roomId || cfg.position.roomId === roomId) && cfg.position.row === rowIdx && cfg.position.col === colIdx
                );
                if (type === 'direction_deflector') {
                    customData.mapping = defCfg?.mapping ?? { up: 'right', right: 'down', down: 'left', left: 'up' };
                }

                return {
                    id:           `${roomId}-${rowIdx}-${colIdx}`,
                    type,
                    position:     { roomId, row: rowIdx, col: colIdx },
                    def:          { ...CELL_DEFS[type] },
                    isElectrified: false,
                    customData,
                };
            })
        );

        // Eski kenarları dönüştür
        const edges = {
            top:    typeof stored.edges.top === 'string' ? { type: stored.edges.top } : stored.edges.top,
            bottom: typeof stored.edges.bottom === 'string' ? { type: stored.edges.bottom } : stored.edges.bottom,
            left:   typeof stored.edges.left === 'string' ? { type: stored.edges.left } : stored.edges.left,
            right:  typeof stored.edges.right === 'string' ? { type: stored.edges.right } : stored.edges.right,
        } as RoomState['edges'];

        rooms[roomId] = {
            id: roomId,
            name: stored.name,
            width: stored.width,
            height: stored.height,
            x: 0,
            y: 0,
            edges,
            grid,
            fogOfWar: false,
            fogVisibilityDistance: 1.5,
            fogKeepRevealed: true,
        };
    }

    // ── 2. ADIM: Teleporter çiftlerini tüm odalarda bağla ───
    const allCells = Object.values(rooms).flatMap(r => r.grid.flat());
    const teleporters = allCells.filter(c => c.type === 'teleport');
    const teleportersByGroup: Record<string, Cell[]> = {};
    for (const tel of teleporters) {
        const group = tel.customData.group as string;
        if (!group) continue;
        if (!teleportersByGroup[group]) teleportersByGroup[group] = [];
        teleportersByGroup[group].push(tel);
    }

    for (const [group, list] of Object.entries(teleportersByGroup)) {
        if (list.length === 2) {
            const [t1, t2] = list;
            t1.customData.targetPos = { ...t2.position };
            t2.customData.targetPos = { ...t1.position };
            // Geriye dönük uyumluluk:
            t1.customData.exitPos = { ...t2.position };
            t1.customData.entrancePos = { ...t1.position };
            t2.customData.exitPos = { ...t1.position };
            t2.customData.entrancePos = { ...t2.position };
        } else if (list.length > 2) {
            // Cyclical path for 3+ portals in a group
            for (let i = 0; i < list.length; i++) {
                const current = list[i];
                const next = list[(i + 1) % list.length];
                current.customData.targetPos = { ...next.position };
                current.customData.exitPos = { ...next.position };
                current.customData.entrancePos = { ...current.position };
            }
        }
    }

    // ── 3. ADIM: Entity'leri oluştur ─────────────────────────
    let nextId = 1;
    const entities: Entity[] = [];

    // Oyuncular
    for (let i = 0; i < stored.initialObjects.length; i++) {
        const obj = stored.initialObjects[i];
        const rId = obj.position.roomId ?? 'main';
        const isLocked = !!obj.lockOnTarget &&
            rooms[rId]?.grid[obj.position.row]?.[obj.position.col]?.type === 'target' &&
            (rooms[rId]?.grid[obj.position.row]?.[obj.position.col]?.customData.playerIndex as number) === i;
        const isOnPowerCell = rooms[rId]?.grid[obj.position.row]?.[obj.position.col]?.type === 'power';

        entities.push({
            id:       nextId++,
            type:     'player',
            position: { roomId: rId, row: obj.position.row, col: obj.position.col },
            physics:  { direction: 'right', force: 0, z: 0 },
            def:      { mass: 1, resistance: 0, isSolid: true },
            traits:   new Set(['player_controlled', 'destructible']),
            isElectrified: isOnPowerCell,
            customData: {
                playerIndex:  i,
                mode:         obj.mode ?? 'normal',
                lockOnTarget: obj.lockOnTarget ?? true,
                isLocked,
            },
        });
    }

    // Kutular
    for (const box of stored.initialBoxes ?? []) {
        const rId = box.position.roomId ?? 'main';
        const isOnPowerCell = rooms[rId]?.grid[box.position.row]?.[box.position.col]?.type === 'power';
        entities.push({
            id:       nextId++,
            type:     'box',
            position: { roomId: rId, row: box.position.row, col: box.position.col },
            physics:  { direction: 'right', force: 0, z: 0 },
            def:      { mass: 2, resistance: 1, isSolid: true },
            traits:   new Set(['pushable', 'destructible']),
            isElectrified: isOnPowerCell,
            customData: {
                requiresPower: box.requiresPower ?? false,
                durabilityEnabled: box.durabilityEnabled ?? false,
                durability: box.durability ?? 3,
                colorFilterEnabled: box.colorFilterEnabled ?? false,
                colorFilterIndex: box.colorFilterIndex ?? 0,
            },
        });
    }

    const initialControlledRooms = stored.initialControlledRooms ?? Object.keys(rooms);

    return { entities, rooms, controlMode, initialControlledRooms };
}
