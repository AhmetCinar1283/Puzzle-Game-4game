import { Cell } from '../../logic/cellTypes';

export const PowerCellRenderer = ({ cell }: { cell: Cell }) => (
    <div style={{
        width: 64, height: 64,
        background: 'rgba(251,191,36,0.12)',
        border: '1px solid rgba(251,191,36,0.6)',
        boxShadow: 'inset 0 0 14px rgba(251,191,36,0.2), 0 0 8px rgba(251,191,36,0.15)',
        boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
        <span style={{ fontSize: 20, color: '#fbbf24', textShadow: '0 0 10px rgba(251,191,36,0.9)', userSelect: 'none' }}>
            ⚡
        </span>
    </div>
);
