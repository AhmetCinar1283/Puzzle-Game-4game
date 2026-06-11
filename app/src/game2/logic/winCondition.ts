// logic/winCondition.ts
// Kazanma koşulu kontrolü — saf fonksiyon, motor dışında tutulur.
// useGameEngine hook'u her tick sonrası bunu çağırır.
//
// Kural: Tüm 'target' hücreleri, doğru playerIndex'e sahip oyuncu tarafından
// işgal edilmişse oyun kazanılmıştır.

import { Entity } from './entityTypes';
import { RoomState } from './types';

export function checkWinCondition(entities: Entity[], rooms: Record<string, RoomState> | any): boolean {
    let targetCount    = 0;
    let satisfiedCount = 0;

    // Tek odalı eski ızgara nesnesi dizisi ise veya Record<string, RoomState> ise uyumlu kıl
    const roomsList: RoomState[] = [];
    if (rooms && typeof rooms === 'object') {
        if (rooms.grid) {
            // Tek bir RoomState
            roomsList.push(rooms);
        } else if (Array.isArray(rooms)) {
            // Cell[][] formatı (eski fallback)
            roomsList.push({
                id: 'main',
                name: 'Main',
                width: rooms[0]?.length ?? 0,
                height: rooms.length,
                x: 0, y: 0,
                edges: { top: { type: 'wall' }, bottom: { type: 'wall' }, left: { type: 'wall' }, right: { type: 'wall' } },
                grid: rooms
            });
        } else {
            // Record<string, RoomState>
            roomsList.push(...(Object.values(rooms) as RoomState[]));
        }
    }

    for (const room of roomsList) {
        for (const row of room.grid) {
            for (const cell of row) {
                if (cell.type !== 'target') continue;
                targetCount++;

                const targetPlayerIndex = (cell.customData.playerIndex as number) ?? 0;
                const isOccupied = entities.some(e =>
                    (!e.position.roomId || !cell.position.roomId || e.position.roomId === cell.position.roomId) &&
                    e.position.row === cell.position.row &&
                    e.position.col === cell.position.col &&
                    e.type === 'player' &&
                    ((e.customData.playerIndex as number) ?? 0) === targetPlayerIndex
                );
                if (isOccupied) satisfiedCount++;
            }
        }
    }

    // En az bir hedef olmalı ve hepsi dolu olmalı
    return targetCount > 0 && satisfiedCount === targetCount;
}
