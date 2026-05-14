// logic/winCondition.ts
// Kazanma koşulu kontrolü — saf fonksiyon, motor dışında tutulur.
// useGameEngine hook'u her tick sonrası bunu çağırır.
//
// Kural: Tüm 'target' hücreleri, doğru playerIndex'e sahip oyuncu tarafından
// işgal edilmişse oyun kazanılmıştır.

import { Entity } from './entityTypes';
import { Cell } from './cellTypes';

export function checkWinCondition(entities: Entity[], grid: Cell[][]): boolean {
    let targetCount    = 0;
    let satisfiedCount = 0;

    for (const row of grid) {
        for (const cell of row) {
            if (cell.type !== 'target') continue;
            targetCount++;

            const targetPlayerIndex = (cell.customData.playerIndex as number) ?? 0;
            const isOccupied = entities.some(e =>
                e.position.row === cell.position.row &&
                e.position.col === cell.position.col &&
                e.type === 'player' &&
                ((e.customData.playerIndex as number) ?? 0) === targetPlayerIndex
            );
            if (isOccupied) satisfiedCount++;
        }
    }

    // En az bir hedef olmalı ve hepsi dolu olmalı
    return targetCount > 0 && satisfiedCount === targetCount;
}
