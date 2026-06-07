import { Cell } from '../../logic/cellTypes';

// Player index → renk (docs/theme.md)
const PLAYER_COLORS: Record<number, { hex: string; rgb: string }> = {
    0: { hex: '#00ff88', rgb: '0,255,136' },   // P1 — Emerald
    1: { hex: '#00c4ff', rgb: '0,196,255' },   // P2 — Sky
};

export const TargetCellRenderer = ({ cell }: { cell: Cell }) => {
    const playerIndex = (cell.customData.playerIndex as number) ?? 0;
    const { hex, rgb } = PLAYER_COLORS[playerIndex] ?? PLAYER_COLORS[0];
    const cellSize = 64;

    return (
        <div style={{
            width: cellSize,
            height: cellSize,
            background: 'rgba(15, 23, 42, 0.65)',
            border: `2px solid rgba(${rgb}, 0.65)`,
            borderRadius: '10px',
            boxShadow: `inset 0 0 16px rgba(${rgb}, 0.25), 0 0 10px rgba(${rgb}, 0.2)`,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div 
                className="target-rotate-anim" 
                style={{
                    border: `1.5px dashed rgba(${rgb}, 0.45)`,
                }}
            />

            <span
                className="target-pulse-anim"
                style={{
                    fontSize: cellSize * 0.42,
                    lineHeight: 1,
                    color: hex,
                    textShadow: `0 0 10px rgba(${rgb}, 0.8)`,
                    userSelect: 'none',
                    display: 'inline-block',
                    zIndex: 1,
                }}
            >
                ◎
            </span>
        </div>
    );
};