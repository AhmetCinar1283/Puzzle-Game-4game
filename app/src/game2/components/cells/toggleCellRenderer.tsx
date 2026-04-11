import { Cell } from '../../logic/cellTypes';

export const ToggleCellRenderer = ({ cell }: { cell: Cell }) => (
    <div style={{
        width: 64, height: 64,
        background: 'rgba(255,215,0,0.07)',
        border: '1px solid rgba(255,215,0,0.45)',
        boxShadow: 'inset 0 0 14px rgba(255,215,0,0.18)',
        boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
        <span style={{ fontSize: 20, color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.7)', userSelect: 'none', fontWeight: 'bold' }}>
            ⇄
        </span>
    </div>
);
