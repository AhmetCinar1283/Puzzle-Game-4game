import type { CellType } from '../types';

interface GameCellProps {
  cellType: CellType;
  cellSize: number;
}

const CELL_CLASSES: Record<CellType, string> = {
  empty: 'bg-slate-100',
  obstacle: 'bg-slate-700',
  forbidden: 'bg-red-500',
  target_1: 'bg-emerald-200 ring-2 ring-inset ring-emerald-500',
  target_2: 'bg-sky-200 ring-2 ring-inset ring-sky-500',
  direction_toggle: 'bg-yellow-300',
};

export default function GameCell({ cellType, cellSize }: GameCellProps) {
  return (
    <div
      className={`${CELL_CLASSES[cellType]} relative flex items-center justify-center`}
      style={{ width: cellSize, height: cellSize }}
    >
      {cellType === 'forbidden' && (
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 0, transparent 50%)',
            backgroundSize: '8px 8px',
          }}
        />
      )}
      {cellType === 'direction_toggle' && (
        <span className="text-yellow-800 text-xs font-bold select-none">⇄</span>
      )}
      {cellType === 'target_1' && (
        <span className="text-emerald-600 text-lg select-none">◎</span>
      )}
      {cellType === 'target_2' && (
        <span className="text-sky-600 text-lg select-none">◎</span>
      )}
    </div>
  );
}
