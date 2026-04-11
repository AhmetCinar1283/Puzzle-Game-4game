import { Cell } from '../../logic/cellTypes';

export const ObstacleCellRenderer = ({ cell }: { cell: Cell }) => (
    <div style={{
        width: 64, height: 64,
        background: 'linear-gradient(135deg, #1a2a40 0%, #111e30 100%)',
        border: '1px solid rgba(100,130,200,0.35)',
        boxShadow: 'inset 0 1px 0 rgba(100,130,200,0.1)',
        boxSizing: 'border-box',
    }} />
);
