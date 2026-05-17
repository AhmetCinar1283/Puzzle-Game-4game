import { Cell } from '../../logic/cellTypes';

// Player index → renk (docs/theme.md)
const PLAYER_COLORS: Record<number, { hex: string; rgb: string }> = {
    0: { hex: '#00ff88', rgb: '0,255,136' },   // P1 — Emerald
    1: { hex: '#00c4ff', rgb: '0,196,255' },   // P2 — Sky
};

export const TargetCellRenderer = ({ cell }: { cell: Cell }) => {
    const playerIndex = (cell.customData.playerIndex as number) ?? 0;
    const { hex, rgb } = PLAYER_COLORS[playerIndex] ?? PLAYER_COLORS[0];
    
    // Eski animasyon sınıflarını yeni oyuncu index'ine göre dinamik olarak belirliyoruz
    const pulseClassName = playerIndex === 0 ? 'target-pulse-green' : 'target-pulse-blue';
    const cellSize = 64;

    return (
        <div style={{
            width: cellSize, height: cellSize,
            background: `rgba(${rgb},0.08)`,
            border: `2px solid rgba(${rgb},0.55)`,
            boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            {/* Eski stil hedef işareti ve animasyonu */}
            <span
                className={pulseClassName}
                style={{
                    fontSize: cellSize * 0.38,
                    lineHeight: 1,
                    color: hex,
                    userSelect: 'none',
                    display: 'inline-block',
                }}
            >
                ◎
            </span>
        </div>
    );
};