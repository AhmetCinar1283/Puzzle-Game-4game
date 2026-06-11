// engine/getNextTopologyPosition.ts
// Kenar (edge) kurallarını uygulayan yardımcı. Çoklu oda ve portal sarmalamasını destekler.

import { Position, Direction, RoomState, EdgeConfig } from '../types';
import { mapCrossEdgeIndex } from './rooms';

export type LevelEdges = Record<'top' | 'bottom' | 'left' | 'right', 'wall' | 'portal' | 'lava' | EdgeConfig>;

export interface LevelBounds {
    rooms?: Record<string, { rows: number; cols: number; edges: {
        top: EdgeConfig;
        bottom: EdgeConfig;
        left: EdgeConfig;
        right: EdgeConfig;
    } }>;
    
    // Eski format (geriye dönük uyumluluk için):
    rows?: number;
    cols?: number;
    edges?: {
        top: 'wall' | 'portal' | 'lava' | EdgeConfig;
        bottom: 'wall' | 'portal' | 'lava' | EdgeConfig;
        left: 'wall' | 'portal' | 'lava' | EdgeConfig;
        right: 'wall' | 'portal' | 'lava' | EdgeConfig;
    };
    trailCollision?: boolean;
}

export function getNextTopologyPosition(
    currentPos: Position,
    direction: Direction,
    level: LevelBounds
): Position | 'lava' | 'wall' {
    const roomId = currentPos.roomId ?? 'main';

    // ── 1. DURUM: Çoklu oda yapısı ──────────────────────────
    if (level.rooms && level.rooms[roomId]) {
        const room = level.rooms[roomId];
        const deltas: Record<Direction, { row: number; col: number }> = {
            up:    { row: -1, col:  0 },
            down:  { row:  1, col:  0 },
            left:  { row:  0, col: -1 },
            right: { row:  0, col:  1 },
        };

        const delta = deltas[direction];
        const nextRow = currentPos.row + delta.row;
        const nextCol = currentPos.col + delta.col;

        // Oda sınırları içinde mi?
        if (nextRow >= 0 && nextRow < room.rows && nextCol >= 0 && nextCol < room.cols) {
            return { roomId, row: nextRow, col: nextCol };
        }

        // Hangi kenar aşıldı?
        let edge: EdgeConfig;
        let crossedDir: 'top' | 'bottom' | 'left' | 'right';

        if (nextRow < 0) {
            edge = room.edges.top;
            crossedDir = 'top';
        } else if (nextRow >= room.rows) {
            edge = room.edges.bottom;
            crossedDir = 'bottom';
        } else if (nextCol < 0) {
            edge = room.edges.left;
            crossedDir = 'left';
        } else {
            edge = room.edges.right;
            crossedDir = 'right';
        }

        if (edge.type === 'wall') return 'wall';
        if (edge.type === 'lava') return 'lava';

        // Portal geçişi: hedef oda ve hedef kenarı belirle
        const targetRoomId = edge.targetRoomId ?? roomId;
        const targetRoom = level.rooms[targetRoomId];
        if (!targetRoom) return 'wall'; // Hedef oda yoksa duvar gibi davran

        const OPPOSITE_EDGE = {
            top: 'bottom',
            bottom: 'top',
            left: 'right',
            right: 'left',
        } as const;

        const targetEdge = edge.targetEdge ?? OPPOSITE_EDGE[crossedDir];

        // Kaynak kenar uzunluğu ve kaynak indis hesabı
        const srcLength = (crossedDir === 'top' || crossedDir === 'bottom') ? room.cols : room.rows;
        const srcIndex = (crossedDir === 'top' || crossedDir === 'bottom') ? currentPos.col : currentPos.row;

        let entryRow = 0;
        let entryCol = 0;

        if (targetEdge === 'top') {
            entryRow = 0;
            entryCol = mapCrossEdgeIndex(srcIndex, srcLength, targetRoom.cols);
        } else if (targetEdge === 'bottom') {
            entryRow = targetRoom.rows - 1;
            entryCol = mapCrossEdgeIndex(srcIndex, srcLength, targetRoom.cols);
        } else if (targetEdge === 'left') {
            entryRow = mapCrossEdgeIndex(srcIndex, srcLength, targetRoom.rows);
            entryCol = 0;
        } else { // 'right'
            entryRow = mapCrossEdgeIndex(srcIndex, srcLength, targetRoom.rows);
            entryCol = targetRoom.cols - 1;
        }

        return { roomId: targetRoomId, row: entryRow, col: entryCol };
    }

    // ── 2. DURUM: Eski tek ızgara yapısı (Fallback) ─────────
    const rows = level.rows ?? 0;
    const cols = level.cols ?? 0;
    const deltas: Record<Direction, { row: number; col: number }> = {
        up:    { row: -1, col:  0 },
        down:  { row:  1, col:  0 },
        left:  { row:  0, col: -1 },
        right: { row:  0, col:  1 },
    };

    const delta = deltas[direction];
    const nextRow = currentPos.row + delta.row;
    const nextCol = currentPos.col + delta.col;

    let edgeRule: 'wall' | 'portal' | 'lava' | EdgeConfig | null = null;
    let portalRow = nextRow;
    let portalCol = nextCol;

    if (nextRow < 0) {
        edgeRule = level.edges?.top ?? 'wall';
        portalRow = rows - 1;
    } else if (nextRow >= rows) {
        edgeRule = level.edges?.bottom ?? 'wall';
        portalRow = 0;
    } else if (nextCol < 0) {
        edgeRule = level.edges?.left ?? 'wall';
        portalCol = cols - 1;
    } else if (nextCol >= cols) {
        edgeRule = level.edges?.right ?? 'wall';
        portalCol = 0;
    }

    const ruleType = (edgeRule && typeof edgeRule === 'object') ? edgeRule.type : edgeRule;

    if (!ruleType) return { roomId, row: nextRow, col: nextCol };
    if (ruleType === 'wall') return 'wall';
    if (ruleType === 'lava') return 'lava';

    // portal
    return { roomId, row: portalRow, col: portalCol };
}
