import type { CellType, Direction, Position } from '../types';

export function posKey(pos: Position): string {
  return `${pos.row},${pos.col}`;
}

export function posEqual(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export const DELTA: Record<Direction, { dRow: number; dCol: number }> = {
  up: { dRow: -1, dCol: 0 },
  down: { dRow: 1, dCol: 0 },
  left: { dRow: 0, dCol: -1 },
  right: { dRow: 0, dCol: 1 },
};

export function cellTypeToConveyorDir(cell: CellType): Direction | null {
  switch (cell) {
    case 'conveyor_up': return 'up';
    case 'conveyor_down': return 'down';
    case 'conveyor_left': return 'left';
    case 'conveyor_right': return 'right';
    default: return null;
  }
}

/** Maps teleporter_in_X → teleporter_out_X. Returns null if not a teleporter_in. */
export function teleporterInToOut(cell: CellType): CellType | null {
  switch (cell) {
    case 'teleporter_in_A': return 'teleporter_out_A';
    case 'teleporter_in_B': return 'teleporter_out_B';
    case 'teleporter_in_C': return 'teleporter_out_C';
    default: return null;
  }
}

export function isTeleporterIn(cell: CellType): boolean {
  return cell === 'teleporter_in_A' || cell === 'teleporter_in_B' || cell === 'teleporter_in_C';
}

export function isTeleporterOut(cell: CellType): boolean {
  return cell === 'teleporter_out_A' || cell === 'teleporter_out_B' || cell === 'teleporter_out_C';
}

export function isConveyor(cell: CellType): boolean {
  return cellTypeToConveyorDir(cell) !== null;
}

/** Returns the first grid position matching targetCell, or null. */
export function findCellPosition(grid: CellType[][], targetCell: CellType): Position | null {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] === targetCell) return { row, col };
    }
  }
  return null;
}
