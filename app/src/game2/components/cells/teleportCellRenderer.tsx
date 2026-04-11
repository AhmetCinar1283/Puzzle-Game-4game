import { Cell } from '../../logic/cellTypes';

type TeleportGroup = 'A' | 'B' | 'C';

const GROUP_COLOR: Record<TeleportGroup, string> = {
    A: '#ec4899', // Pembe
    B: '#f97316', // Turuncu
    C: '#14b8a6', // Teal
};

export const TeleportCellRenderer = ({ cell }: { cell: Cell }) => {
    const group = (cell.customData.group as TeleportGroup) ?? 'A';
    const isIn  = (cell.customData.isIn as boolean) ?? true;
    const color = GROUP_COLOR[group];

    return (
        <div style={{
            width: 64, height: 64,
            background: isIn ? `rgba(${hexToRgb(color)},0.12)` : `rgba(${hexToRgb(color)},0.06)`,
            border: `2px solid rgba(${hexToRgb(color)},${isIn ? 0.6 : 0.4})`,
            boxShadow: isIn
                ? `inset 0 0 14px rgba(${hexToRgb(color)},0.2), 0 0 8px rgba(${hexToRgb(color)},0.15)`
                : `inset 0 0 10px rgba(${hexToRgb(color)},0.12)`,
            boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
        }}>
            <span style={{ fontSize: 14, color, textShadow: `0 0 8px ${color}`, userSelect: 'none', lineHeight: 1 }}>
                {isIn ? '⟿' : '⟾'}
            </span>
            <span style={{ fontSize: 13, color, textShadow: `0 0 6px ${color}`, userSelect: 'none', fontWeight: 'bold', lineHeight: 1 }}>
                {group}
            </span>
        </div>
    );
};

// #rrggbb → "r,g,b" (rgba() için)
function hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
}
