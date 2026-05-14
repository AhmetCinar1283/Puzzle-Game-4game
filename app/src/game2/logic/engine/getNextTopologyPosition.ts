// engine/getNextTopologyPosition.ts
// Kenar (edge) kurallarını uygulayan yardımcı.

import { Position, Direction } from '../types';

export interface LevelEdges {
    top: 'wall' | 'portal' | 'lava';
    bottom: 'wall' | 'portal' | 'lava';
    left: 'wall' | 'portal' | 'lava';
    right: 'wall' | 'portal' | 'lava';
}

export interface LevelBounds {
    rows: number;
    cols: number;
    edges: LevelEdges;
}

export function getNextTopologyPosition(
    currentPos: Position,
    direction: Direction,
    level: LevelBounds
): Position | 'lava' | 'wall' {
    const deltas: Record<Direction, Position> = {
        up:    { row: -1, col:  0 },
        down:  { row:  1, col:  0 },
        left:  { row:  0, col: -1 },
        right: { row:  0, col:  1 },
    };

    const delta = deltas[direction];
    const nextRow = currentPos.row + delta.row;
    const nextCol = currentPos.col + delta.col;

    // Hangi kenara çıkıldığını belirle
    let edgeRule: 'wall' | 'portal' | 'lava' | null = null;
    let portalRow = nextRow;
    let portalCol = nextCol;

    if (nextRow < 0) {
        edgeRule = level.edges.top;
        portalRow = level.rows - 1;
    } else if (nextRow >= level.rows) {
        edgeRule = level.edges.bottom;
        portalRow = 0;
    } else if (nextCol < 0) {
        edgeRule = level.edges.left;
        portalCol = level.cols - 1;
    } else if (nextCol >= level.cols) {
        edgeRule = level.edges.right;
        portalCol = 0;
    }

    if (edgeRule === null)    return { row: nextRow, col: nextCol };
    if (edgeRule === 'wall')  return 'wall';
    if (edgeRule === 'lava')  return 'lava';
    /* portal */              return { row: portalRow, col: portalCol };
}
