import type { CellType } from '../types';

interface GameCellProps {
  cellType: CellType;
  cellSize: number;
}

const CELL_STYLE: Record<CellType, React.CSSProperties> = {
  empty: {
    background: '#0d1928',
    border: '1px solid rgba(30, 58, 138, 0.25)',
  },
  obstacle: {
    background: 'linear-gradient(135deg, #1a2a40 0%, #111e30 100%)',
    border: '1px solid rgba(100, 130, 200, 0.35)',
    boxShadow: 'inset 0 1px 0 rgba(100,130,200,0.1)',
  },
  forbidden: {
    background: 'rgba(220, 20, 50, 0.18)',
    border: '1px solid rgba(255, 30, 60, 0.5)',
    boxShadow: 'inset 0 0 14px rgba(255, 0, 50, 0.25)',
  },
  target_1: {
    background: 'rgba(0, 255, 136, 0.07)',
    border: '2px solid rgba(0, 255, 136, 0.55)',
    boxShadow: 'inset 0 0 16px rgba(0, 255, 136, 0.2)',
  },
  target_2: {
    background: 'rgba(0, 196, 255, 0.07)',
    border: '2px solid rgba(0, 196, 255, 0.55)',
    boxShadow: 'inset 0 0 16px rgba(0, 196, 255, 0.2)',
  },
  direction_toggle: {
    background: 'rgba(255, 215, 0, 0.07)',
    border: '1px solid rgba(255, 215, 0, 0.45)',
    boxShadow: 'inset 0 0 14px rgba(255, 215, 0, 0.18)',
  },
};

export default function GameCell({ cellType, cellSize }: GameCellProps) {
  return (
    <div
      style={{
        width: cellSize,
        height: cellSize,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        ...CELL_STYLE[cellType],
      }}
    >
      {cellType === 'forbidden' && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.25,
              backgroundImage:
                'repeating-linear-gradient(45deg, #ff1744 0, #ff1744 1.5px, transparent 0, transparent 50%)',
              backgroundSize: '8px 8px',
            }}
          />
          <span
            style={{
              fontSize: cellSize * 0.32,
              lineHeight: 1,
              color: 'rgba(255, 60, 80, 0.7)',
              userSelect: 'none',
              position: 'relative',
              zIndex: 1,
            }}
          >
            ✕
          </span>
        </>
      )}
      {cellType === 'direction_toggle' && (
        <span
          style={{
            fontSize: cellSize * 0.3,
            lineHeight: 1,
            color: '#ffd700',
            textShadow: '0 0 8px rgba(255,215,0,0.7)',
            userSelect: 'none',
            fontWeight: 'bold',
          }}
        >
          ⇄
        </span>
      )}
      {cellType === 'target_1' && (
        <span
          style={{
            fontSize: cellSize * 0.38,
            lineHeight: 1,
            color: '#00ff88',
            textShadow: '0 0 10px rgba(0,255,136,0.8)',
            userSelect: 'none',
          }}
        >
          ◎
        </span>
      )}
      {cellType === 'target_2' && (
        <span
          style={{
            fontSize: cellSize * 0.38,
            lineHeight: 1,
            color: '#00c4ff',
            textShadow: '0 0 10px rgba(0,196,255,0.8)',
            userSelect: 'none',
          }}
        >
          ◎
        </span>
      )}
    </div>
  );
}
