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

    // Add 20px padding on all 4 outer sides
    const outerPadding = 20;
    const totalWidth = colOffsets[maxX + 1] - gap + outerPadding * 2;
    const totalHeight = rowOffsets[maxY + 1] - gap + outerPadding * 2;

    const roomPositions = roomsList.reduce((acc, r) => {
        acc[r.id] = {
            left: colOffsets[r.x] + outerPadding,
            top: rowOffsets[r.y] + outerPadding,
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

export function getEdgePoint(
    offset: { left: number; top: number; width: number; height: number },
    side: 'top' | 'bottom' | 'left' | 'right'
) {
    switch (side) {
        case 'top':
            return { x: offset.left + offset.width / 2, y: offset.top };
        case 'bottom':
            return { x: offset.left + offset.width / 2, y: offset.top + offset.height };
        case 'left':
            return { x: offset.left, y: offset.top + offset.height / 2 };
        case 'right':
            return { x: offset.left + offset.width, y: offset.top + offset.height / 2 };
    }
}

export function getGutterCoords(rooms: any, cellSize: number, gap: number) {
    const roomsList = Array.isArray(rooms) ? rooms : Object.values(rooms);
    if (roomsList.length === 0) {
        return { GX: [], GY: [] };
    }

    let maxX = 0;
    let maxY = 0;
    for (const r of roomsList) {
        if (r.x > maxX) maxX = r.x;
        if (r.y > maxY) maxY = r.y;
    }

    const colWidths = new Array(maxX + 1).fill(0);
    const rowHeights = new Array(maxY + 1).fill(0);

    for (const r of roomsList) {
        const w = r.width * cellSize;
        const h = r.height * cellSize;
        if (w > colWidths[r.x]) colWidths[r.x] = w;
        if (h > rowHeights[r.y]) rowHeights[r.y] = h;
    }

    const colOffsets = new Array(maxX + 2).fill(0);
    for (let x = 0; x <= maxX; x++) {
        colOffsets[x + 1] = colOffsets[x] + colWidths[x] + gap;
    }

    const rowOffsets = new Array(maxY + 2).fill(0);
    for (let y = 0; y <= maxY; y++) {
        rowOffsets[y + 1] = rowOffsets[y] + rowHeights[y] + gap;
    }

    const outerPadding = 20;
    const totalWidth = colOffsets[maxX + 1] - gap + outerPadding * 2;
    const totalHeight = rowOffsets[maxY + 1] - gap + outerPadding * 2;

    const GX: number[] = [];
    for (let x = 0; x <= maxX + 1; x++) {
        if (x === 0) {
            GX.push(10);
        } else if (x === maxX + 1) {
            GX.push(totalWidth - 10);
        } else {
            GX.push(colOffsets[x] - gap / 2 + outerPadding);
        }
    }

    const GY: number[] = [];
    for (let y = 0; y <= maxY + 1; y++) {
        if (y === 0) {
            GY.push(10);
        } else if (y === maxY + 1) {
            GY.push(totalHeight - 10);
        } else {
            GY.push(rowOffsets[y] - gap / 2 + outerPadding);
        }
    }

    return { GX, GY };
}

export function getRoundedCornerPath(points: { x: number; y: number }[], radius = 12): string {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length - 1; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        const p3 = points[i + 1];
        
        const d1 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const d2 = { x: p3.x - p2.x, y: p3.y - p2.y };
        
        const len1 = Math.sqrt(d1.x * d1.x + d1.y * d1.y);
        const len2 = Math.sqrt(d2.x * d2.x + d2.y * d2.y);
        
        const r = Math.min(radius, len1 / 2, len2 / 2);
        
        if (r < 0.1) {
            d += ` L ${p2.x} ${p2.y}`;
            continue;
        }

        const cornerStart = {
            x: p2.x - (d1.x / len1) * r,
            y: p2.y - (d1.y / len1) * r
        };
        
        const cornerEnd = {
            x: p2.x + (d2.x / len2) * r,
            y: p2.y + (d2.y / len2) * r
        };
        
        d += ` L ${cornerStart.x} ${cornerStart.y} Q ${p2.x} ${p2.y}, ${cornerEnd.x} ${cornerEnd.y}`;
    }
    
    d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
    return d;
}

export function routePortalPath(
    roomAId: string,
    sideA: 'top' | 'bottom' | 'left' | 'right',
    roomBId: string,
    sideB: 'top' | 'bottom' | 'left' | 'right',
    roomPositions: Record<string, { left: number; top: number; width: number; height: number }>,
    rooms: any,
    cellSize: number,
    gap: number,
    connIdx: number,
    totalConnections: number
): string {
    const offsetA = roomPositions[roomAId];
    const offsetB = roomPositions[roomBId];
    if (!offsetA || !offsetB) return '';

    const roomsList = Array.isArray(rooms) ? rooms : Object.values(rooms);
    const roomA = roomsList.find((r: any) => r.id === roomAId);
    const roomB = roomsList.find((r: any) => r.id === roomBId);
    if (!roomA || !roomB) return '';

    const pA = getEdgePoint(offsetA, sideA);
    const pB = getEdgePoint(offsetB, sideB);

    const { GX, GY } = getGutterCoords(rooms, cellSize, gap);
    
    const getGX = (idx: number) => {
        if (idx < 0) return GX[0] ?? 0;
        if (idx >= GX.length) return GX[GX.length - 1] ?? 0;
        return GX[idx];
    };
    const getGY = (idx: number) => {
        if (idx < 0) return GY[0] ?? 0;
        if (idx >= GY.length) return GY[GY.length - 1] ?? 0;
        return GY[idx];
    };

    // Calculate line separation shift
    const spacing = 8;
    const shift = totalConnections > 1 ? (connIdx - (totalConnections - 1) / 2) * spacing : 0;

    const dx = roomB.x - roomA.x;
    const dy = roomB.y - roomA.y;

    const isFacingAdjacent =
        (sideA === 'right' && sideB === 'left' && dx === 1 && dy === 0) ||
        (sideA === 'left' && sideB === 'right' && dx === -1 && dy === 0) ||
        (sideA === 'bottom' && sideB === 'top' && dx === 0 && dy === 1) ||
        (sideA === 'top' && sideB === 'bottom' && dx === 0 && dy === -1);

    if (isFacingAdjacent) {
        if (sideA === 'left' || sideA === 'right') {
            const pA_out_x = sideA === 'left' ? pA.x - 8 : pA.x + 8;
            const pB_out_x = sideB === 'left' ? pB.x - 8 : pB.x + 8;
            return getRoundedCornerPath([
                pA,
                { x: pA_out_x, y: pA.y + shift },
                { x: pB_out_x, y: pB.y + shift },
                pB
            ], 12);
        } else {
            const pA_out_y = sideA === 'top' ? pA.y - 8 : pA.y + 8;
            const pB_out_y = sideB === 'top' ? pB.y - 8 : pB.y + 8;
            return getRoundedCornerPath([
                pA,
                { x: pA.x + shift, y: pA_out_y },
                { x: pB.x + shift, y: pB_out_y },
                pB
            ], 12);
        }
    }

    const getVector = (side: 'top' | 'bottom' | 'left' | 'right') => {
        switch (side) {
            case 'top': return { x: 0, y: -1 };
            case 'bottom': return { x: 0, y: 1 };
            case 'left': return { x: -1, y: 0 };
            case 'right': return { x: 1, y: 0 };
        }
    };

    const vA = getVector(sideA);
    const vB = getVector(sideB);

    const OUT_DIST = 8;
    const pA_out = { x: pA.x + vA.x * OUT_DIST, y: pA.y + vA.y * OUT_DIST };
    const pB_out = { x: pB.x + vB.x * OUT_DIST, y: pB.y + vB.y * OUT_DIST };

    let y_ext_A = 0;
    let x_ext_A = 0;
    if (sideA === 'top') {
        y_ext_A = getGY(roomA.y) + shift;
        x_ext_A = pA.x + shift;
    } else if (sideA === 'bottom') {
        y_ext_A = getGY(roomA.y + 1) + shift;
        x_ext_A = pA.x + shift;
    } else if (sideA === 'left') {
        x_ext_A = getGX(roomA.x) + shift;
        y_ext_A = pA.y + shift;
    } else { // right
        x_ext_A = getGX(roomA.x + 1) + shift;
        y_ext_A = pA.y + shift;
    }

    let y_ext_B = 0;
    let x_ext_B = 0;
    if (sideB === 'top') {
        y_ext_B = getGY(roomB.y) + shift;
        x_ext_B = pB.x + shift;
    } else if (sideB === 'bottom') {
        y_ext_B = getGY(roomB.y + 1) + shift;
        x_ext_B = pB.x + shift;
    } else if (sideB === 'left') {
        x_ext_B = getGX(roomB.x) + shift;
        y_ext_B = pB.y + shift;
    } else { // right
        x_ext_B = getGX(roomB.x + 1) + shift;
        y_ext_B = pB.y + shift;
    }

    const pA_ext = { x: x_ext_A, y: y_ext_A };
    const pB_ext = { x: x_ext_B, y: y_ext_B };

    const isHorizA = sideA === 'top' || sideA === 'bottom';
    const isHorizB = sideB === 'top' || sideB === 'bottom';

    let points: { x: number; y: number }[] = [pA, pA_out, pA_ext];

    if (isHorizA && isHorizB) {
        const rx_mid = pB.x < pA.x ? roomA.x : roomA.x + 1;
        const x_mid = getGX(rx_mid) + shift;
        points.push({ x: x_mid, y: y_ext_A });
        points.push({ x: x_mid, y: y_ext_B });
    } else if (!isHorizA && !isHorizB) {
        const ry_mid = pB.y < pA.y ? roomA.y : roomA.y + 1;
        const y_mid = getGY(ry_mid) + shift;
        points.push({ x: x_ext_A, y: y_mid });
        points.push({ x: x_ext_B, y: y_mid });
    } else if (isHorizA && !isHorizB) {
        points.push({ x: x_ext_B, y: y_ext_A });
    } else {
        points.push({ x: x_ext_A, y: y_ext_B });
    }

    points.push(pB_ext);
    points.push(pB_out);
    points.push(pB);

    return getRoundedCornerPath(points, 12);
}
