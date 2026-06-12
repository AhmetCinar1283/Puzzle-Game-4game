import type { CellType } from '../types';
import { getPlayerColor } from '../../game2/components/playerColors';

const GROUP_COLORS: Record<string, string> = {
  A: '#ec4899',
  B: '#f97316',
  C: '#14b8a6',
  D: '#a855f7',
  E: '#eab308',
  F: '#ef4444',
  G: '#3b82f6',
};

function getGroupColor(group: string): string {
  if (GROUP_COLORS[group]) return GROUP_COLORS[group];
  let hash = 0;
  for (let i = 0; i < group.length; i++) {
    hash = group.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 85%, 60%)`;
}

interface GameCellProps {
  cellType: string;
  cellSize: number;
  /** For conveyor cells: whether the conveyor is currently powered/active (affects visual). */
  isPowered?: boolean;
}

const CELL_STYLE: Record<string, React.CSSProperties> = {
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
  direction_deflector: {
    background: 'rgba(236, 72, 153, 0.12)',
    border: '2px solid rgba(236, 72, 153, 0.6)',
    boxShadow: 'inset 0 0 14px rgba(236, 72, 153, 0.2), 0 0 8px rgba(236, 72, 153, 0.15)',
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
  trampoline_up: {
    background: 'rgba(34, 211, 238, 0.12)',
    border: '2px solid rgba(34, 211, 238, 0.6)',
    boxShadow: 'inset 0 0 14px rgba(34, 211, 238, 0.2), 0 0 8px rgba(34, 211, 238, 0.15)',
  },
  trampoline_down: {
    background: 'rgba(34, 211, 238, 0.12)',
    border: '2px solid rgba(34, 211, 238, 0.6)',
    boxShadow: 'inset 0 0 14px rgba(34, 211, 238, 0.2), 0 0 8px rgba(34, 211, 238, 0.15)',
  },
  trampoline_left: {
    background: 'rgba(34, 211, 238, 0.12)',
    border: '2px solid rgba(34, 211, 238, 0.6)',
    boxShadow: 'inset 0 0 14px rgba(34, 211, 238, 0.2), 0 0 8px rgba(34, 211, 238, 0.15)',
  },
  trampoline_right: {
    background: 'rgba(34, 211, 238, 0.12)',
    border: '2px solid rgba(34, 211, 238, 0.6)',
    boxShadow: 'inset 0 0 14px rgba(34, 211, 238, 0.2), 0 0 8px rgba(34, 211, 238, 0.15)',
  },
};

const CONVEYOR_ICON = (cellSize: number, conveyorDim: boolean) => {
  return (
    <svg width={cellSize*0.55} height={cellSize*0.55} viewBox="0 0 24 24" fill="none" stroke={conveyorDim ? '#6b4fa0' : '#c4b5fd'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: conveyorDim ? 'none' : 'drop-shadow(0 0 5px rgba(196,181,253,0.8))' }}>
      <path d="M6 21l6-6 6 6" />
      <path d="M6 14l6-6 6 6" />
      <path d="M6 7l6-6 6 6" />
    </svg>
  )
}

const TRAMPOLINE_ICON = (cellSize: number) => {
  return (
    <svg
      width={cellSize * 0.55}
      height={cellSize * 0.55}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#22d3ee"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.8))' // Neon parlaması
      }}
    >
      {/* 3 adet yukarı doğru fırlatan kavisli çizgi */}
      <path d="M12 22V12" />
      <path d="M12 12C12 12 17 16 19 12C21 8 12 2 12 2" />
      <path d="M12 12C12 12 7 16 5 12C3 8 12 2 12 2" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

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

// Yönleri açıya çeviren basit bir yardımcı fonksiyon
const getRotation = (cellType: string) => {
  if (cellType.includes('up')) return '0deg';
  if (cellType.includes('right')) return '90deg';
  if (cellType.includes('down')) return '180deg';
  if (cellType.includes('left')) return '270deg';
  return '0deg';
};

export default function GameCell({ cellType, cellSize, isPowered }: GameCellProps) {
  const isConveyor = cellType.startsWith('conveyor_');
  const isLauncher = cellType.startsWith('launcher_');
  const isTrampoline = cellType.startsWith('trampoline_');
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

      {/* Direction deflector */}
      {cellType === 'direction_deflector' && (
        <span
          style={{
            fontSize: cellSize * 0.32,
            lineHeight: 1,
            color: '#ec4899',
            textShadow: '0 0 8px rgba(236,72,153,0.7)',
            userSelect: 'none',
            fontWeight: 'bold',
          }}
        >
          ⤭
        </span>
      )}

      {/* Dynamic Target Cells */}
      {cellType.startsWith('target_') && (() => {
        const idx = parseInt(cellType.substring('target_'.length), 10) - 1;
        const color = getPlayerColor(isNaN(idx) ? 0 : idx).hex;
        return (
          <span
            className="target-pulse-blue"
            style={{
              fontSize: cellSize * 0.38,
              lineHeight: 1,
              color: color,
              userSelect: 'none',
              display: 'inline-block',
            }}
          >
            ◎
          </span>
        );
      })()}

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

      {/* Trampoline */}
      {isTrampoline && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            transform: `rotate(${getRotation(cellType)})`, // Yöne göre çevir
          }}
        >
          {/* Zıplama/Yay İkonu (SVG) */}
          {TRAMPOLINE_ICON(cellSize)}
        </div>
      )}

      {/* Conveyor belts */}
      {isConveyor && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            transform: `rotate(${getRotation(cellType)})`,
            opacity: conveyorDim ? 0.5 : 1,
          }}
        >
          {/* Çift Ok (Chevron) İkonu (SVG) */}
          {CONVEYOR_ICON(cellSize, conveyorDim)}
        </div>
      )}

      {/* Teleporters */}
      {isTeleporter && (() => {
        const group = cellType.substring(cellType.lastIndexOf('_') + 1);
        const color = getGroupColor(group);
        return (
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
                color: color,
                textShadow: `0 0 8px ${color}`,
                userSelect: 'none',
              }}
            >
              {isTeleporterIn ? '⟿' : '⟾'}
            </span>
            <span
              style={{
                fontSize: cellSize * 0.2,
                lineHeight: 1,
                color: color,
                textShadow: `0 0 6px ${color}`,
                userSelect: 'none',
                fontWeight: 'bold',
              }}
            >
              {group}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
