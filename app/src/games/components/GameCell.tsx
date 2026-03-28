import type { CellType } from '../types';

interface GameCellProps {
  cellType: CellType;
  cellSize: number;
  /** For conveyor cells: whether the conveyor is currently powered/active (affects visual). */
  isPowered?: boolean;
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
  ice: {
    background: 'rgba(147, 210, 255, 0.12)',
    border: '1px solid rgba(165, 243, 252, 0.45)',
    boxShadow: 'inset 0 0 10px rgba(165, 243, 252, 0.25)',
  },
  power_node: {
    background: 'rgba(251, 191, 36, 0.12)',
    border: '1px solid rgba(251, 191, 36, 0.6)',
    boxShadow: 'inset 0 0 14px rgba(251, 191, 36, 0.2), 0 0 8px rgba(251, 191, 36, 0.15)',
  },
  conveyor_up: {
    background: 'rgba(139, 92, 246, 0.12)',
    border: '1px solid rgba(139, 92, 246, 0.4)',
    boxShadow: 'inset 0 0 10px rgba(139, 92, 246, 0.15)',
  },
  conveyor_down: {
    background: 'rgba(139, 92, 246, 0.12)',
    border: '1px solid rgba(139, 92, 246, 0.4)',
    boxShadow: 'inset 0 0 10px rgba(139, 92, 246, 0.15)',
  },
  conveyor_left: {
    background: 'rgba(139, 92, 246, 0.12)',
    border: '1px solid rgba(139, 92, 246, 0.4)',
    boxShadow: 'inset 0 0 10px rgba(139, 92, 246, 0.15)',
  },
  conveyor_right: {
    background: 'rgba(139, 92, 246, 0.12)',
    border: '1px solid rgba(139, 92, 246, 0.4)',
    boxShadow: 'inset 0 0 10px rgba(139, 92, 246, 0.15)',
  },
  teleporter_in_A: {
    background: 'rgba(236, 72, 153, 0.12)',
    border: '2px solid rgba(236, 72, 153, 0.6)',
    boxShadow: 'inset 0 0 14px rgba(236, 72, 153, 0.2), 0 0 8px rgba(236, 72, 153, 0.15)',
  },
  teleporter_out_A: {
    background: 'rgba(236, 72, 153, 0.06)',
    border: '2px solid rgba(236, 72, 153, 0.4)',
    boxShadow: 'inset 0 0 10px rgba(236, 72, 153, 0.12)',
  },
  teleporter_in_B: {
    background: 'rgba(249, 115, 22, 0.12)',
    border: '2px solid rgba(249, 115, 22, 0.6)',
    boxShadow: 'inset 0 0 14px rgba(249, 115, 22, 0.2), 0 0 8px rgba(249, 115, 22, 0.15)',
  },
  teleporter_out_B: {
    background: 'rgba(249, 115, 22, 0.06)',
    border: '2px solid rgba(249, 115, 22, 0.4)',
    boxShadow: 'inset 0 0 10px rgba(249, 115, 22, 0.12)',
  },
  teleporter_in_C: {
    background: 'rgba(20, 184, 166, 0.12)',
    border: '2px solid rgba(20, 184, 166, 0.6)',
    boxShadow: 'inset 0 0 14px rgba(20, 184, 166, 0.2), 0 0 8px rgba(20, 184, 166, 0.15)',
  },
  teleporter_out_C: {
    background: 'rgba(20, 184, 166, 0.06)',
    border: '2px solid rgba(20, 184, 166, 0.4)',
    boxShadow: 'inset 0 0 10px rgba(20, 184, 166, 0.12)',
  },
};

const CONVEYOR_ICON: Record<string, string> = {
  conveyor_up: '▲',
  conveyor_down: '▼',
  conveyor_left: '◄',
  conveyor_right: '►',
};

const TELEPORTER_LABEL: Partial<Record<CellType, string>> = {
  teleporter_in_A: 'A', teleporter_out_A: 'A',
  teleporter_in_B: 'B', teleporter_out_B: 'B',
  teleporter_in_C: 'C', teleporter_out_C: 'C',
};

const TELEPORTER_COLOR: Partial<Record<CellType, string>> = {
  teleporter_in_A: '#ec4899', teleporter_out_A: '#ec4899',
  teleporter_in_B: '#f97316', teleporter_out_B: '#f97316',
  teleporter_in_C: '#14b8a6', teleporter_out_C: '#14b8a6',
};

export default function GameCell({ cellType, cellSize, isPowered }: GameCellProps) {
  const isConveyor = cellType.startsWith('conveyor_');
  const isTeleporterIn = cellType.startsWith('teleporter_in_');
  const isTeleporterOut = cellType.startsWith('teleporter_out_');
  const isTeleporter = isTeleporterIn || isTeleporterOut;
  const conveyorDim = isConveyor && isPowered === false;

  const baseStyle = CELL_STYLE[cellType];
  const style: React.CSSProperties = conveyorDim
    ? {
        ...baseStyle,
        opacity: 0.4,
        filter: 'grayscale(0.5)',
      }
    : baseStyle;

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
        ...style,
      }}
    >
      {/* Forbidden: diagonal stripes + X icon */}
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

      {/* Direction toggle */}
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

      {/* Target 1 */}
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

      {/* Target 2 */}
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

      {/* Ice */}
      {cellType === 'ice' && (
        <span
          style={{
            fontSize: cellSize * 0.3,
            lineHeight: 1,
            color: '#a5f3fc',
            textShadow: '0 0 8px rgba(165,243,252,0.8)',
            userSelect: 'none',
          }}
        >
          ❄
        </span>
      )}

      {/* Power node */}
      {cellType === 'power_node' && (
        <span
          style={{
            fontSize: cellSize * 0.3,
            lineHeight: 1,
            color: '#fbbf24',
            textShadow: '0 0 10px rgba(251,191,36,0.9)',
            userSelect: 'none',
            fontWeight: 'bold',
          }}
        >
          ⚡
        </span>
      )}

      {/* Conveyor belts */}
      {isConveyor && (
        <span
          style={{
            fontSize: cellSize * 0.32,
            lineHeight: 1,
            color: conveyorDim ? '#6b4fa0' : '#c4b5fd',
            textShadow: conveyorDim ? 'none' : '0 0 8px rgba(196,181,253,0.7)',
            userSelect: 'none',
            fontWeight: 'bold',
          }}
        >
          {CONVEYOR_ICON[cellType]}
        </span>
      )}

      {/* Teleporters */}
      {isTeleporter && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <span
            style={{
              fontSize: cellSize * 0.22,
              lineHeight: 1,
              color: TELEPORTER_COLOR[cellType] ?? '#fff',
              textShadow: `0 0 8px ${TELEPORTER_COLOR[cellType] ?? '#fff'}`,
              userSelect: 'none',
            }}
          >
            {isTeleporterIn ? '⟿' : '⟾'}
          </span>
          <span
            style={{
              fontSize: cellSize * 0.2,
              lineHeight: 1,
              color: TELEPORTER_COLOR[cellType] ?? '#fff',
              textShadow: `0 0 6px ${TELEPORTER_COLOR[cellType] ?? '#fff'}`,
              userSelect: 'none',
              fontWeight: 'bold',
            }}
          >
            {TELEPORTER_LABEL[cellType]}
          </span>
        </div>
      )}
    </div>
  );
}
