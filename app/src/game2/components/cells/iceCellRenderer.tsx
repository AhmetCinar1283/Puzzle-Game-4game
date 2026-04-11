import { Cell } from '../../logic/cellTypes';

export const IceCellRenderer = ({ cell }: { cell: Cell }) => (
    <div style={{
        width: 64, height: 64,
        background: 'rgba(147,210,255,0.12)',
        border: '1px solid rgba(165,243,252,0.45)',
        boxShadow: 'inset 0 0 10px rgba(165,243,252,0.25)',
        boxSizing: 'border-box',
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
        <span style={{ fontSize: 20, color: '#a5f3fc', textShadow: '0 0 8px rgba(165,243,252,0.8)', userSelect: 'none' }}>
            ❄
        </span>
    </div>
);
