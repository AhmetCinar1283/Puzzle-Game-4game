import { Cell } from '../../logic/cellTypes';

// Player index → renk (docs/theme.md)
const PLAYER_COLORS: Record<number, { hex: string; rgb: string }> = {
    0: { hex: '#00ff88', rgb: '0,255,136' },   // P1 — Emerald
    1: { hex: '#00c4ff', rgb: '0,196,255' },   // P2 — Sky
};

export const TargetCellRenderer = ({ cell }: { cell: Cell }) => {
    const playerIndex = (cell.customData.playerIndex as number) ?? 0;
    const { hex, rgb } = PLAYER_COLORS[playerIndex] ?? PLAYER_COLORS[0];

    return (
        <div style={{
            width: 64, height: 64,
            background: `rgba(${rgb},0.08)`,
            border: `2px dashed rgba(${rgb},0.55)`,
            boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            {/* Hedef işareti — iç içe iki kare + merkez nokta */}
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <rect x="3"  y="3"  width="18" height="18" rx="2"
                    stroke={hex} strokeWidth="1.5" strokeOpacity="0.5" />
                <rect x="7"  y="7"  width="10" height="10" rx="1"
                    stroke={hex} strokeWidth="1.5" strokeOpacity="0.75" />
                <circle cx="12" cy="12" r="2"
                    fill={hex} style={{ filter: `drop-shadow(0 0 4px ${hex})` }} />
            </svg>
        </div>
    );
};
