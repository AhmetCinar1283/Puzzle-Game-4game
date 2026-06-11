// engine/rooms.ts
// Oda yerleşimi, kenar geçiş koordinat ölçekleme ve güvenli hücre erişim yardımcıları.

import { Cell } from '../cellTypes';
import { Position, RoomState } from '../types';

/**
 * Proportional index mapping across room borders.
 * Maps coordinates proportionally when an entity transitions between borders of different sizes.
 */
export function mapCrossEdgeIndex(index: number, srcSize: number, dstSize: number): number {
    if (srcSize <= 1) return 0;
    const ratio = index / (srcSize - 1);
    return Math.min(dstSize - 1, Math.max(0, Math.round(ratio * (dstSize - 1))));
}

/**
 * Safe cell retrieval supporting both:
 * - Single-grid mode (Cell[][])
 * - Multi-room mode (Record<string, RoomState>)
 */
export function getCellAt(rooms: any, pos: Position): Cell | undefined {
    if (!pos) return undefined;
    
    // If multi-room
    if (pos.roomId && typeof rooms === 'object' && !Array.isArray(rooms)) {
        return rooms[pos.roomId]?.grid[pos.row]?.[pos.col];
    }
    
    // If single-grid 2D array
    if (Array.isArray(rooms)) {
        return rooms[pos.row]?.[pos.col];
    }
    
    // Fallback: if rooms is a dictionary but roomId is not defined or defaults to 'main'
    const firstRoom = Object.values(rooms)[0] as RoomState | undefined;
    if (firstRoom && firstRoom.grid) {
        return firstRoom.grid[pos.row]?.[pos.col];
    }
    
    return undefined;
}

/**
 * Calculates absolute layout offsets for multiple rooms on a unified grid.
 */
export interface RoomLayoutConfig {
    id: string;
    width: number;
    height: number;
    x: number;
    y: number;
}

export function calculateRoomLayoutOffsets(
    rooms: Record<string, RoomLayoutConfig> | RoomLayoutConfig[],
    cellSize = 64,
    gap = 40
) {
    const roomsList = Array.isArray(rooms) ? rooms : Object.values(rooms);
    if (roomsList.length === 0) {
        return { roomPositions: {}, totalWidth: 0, totalHeight: 0 };
    }

    // Find max x and y
    let maxX = 0;
    let maxY = 0;
    for (const r of roomsList) {
        if (r.x > maxX) maxX = r.x;
        if (r.y > maxY) maxY = r.y;
    }

    // Determine the max width of rooms in each column, and max height of rooms in each row
    const colWidths = new Array(maxX + 1).fill(0);
    const rowHeights = new Array(maxY + 1).fill(0);

    for (const r of roomsList) {
        const w = r.width * cellSize;
        const h = r.height * cellSize;
        if (w > colWidths[r.x]) colWidths[r.x] = w;
        if (h > rowHeights[r.y]) rowHeights[r.y] = h;
    }

    // Cumulative column and row offsets
    const colOffsets = new Array(maxX + 2).fill(0);
    for (let x = 0; x <= maxX; x++) {
        colOffsets[x + 1] = colOffsets[x] + colWidths[x] + gap;
    }

    const rowOffsets = new Array(maxY + 2).fill(0);
    for (let y = 0; y <= maxY; y++) {
        rowOffsets[y + 1] = rowOffsets[y] + rowHeights[y] + gap;
    }

    const totalWidth = colOffsets[maxX + 1] - gap;
    const totalHeight = rowOffsets[maxY + 1] - gap;

    const roomPositions = roomsList.reduce((acc, r) => {
        acc[r.id] = {
            left: colOffsets[r.x],
            top: rowOffsets[r.y],
            width: r.width * cellSize,
            height: r.height * cellSize,
        };
        return acc;
    }, {} as Record<string, { left: number; top: number; width: number; height: number }>);

    return {
        roomPositions,
        totalWidth,
        totalHeight,
    };
}
