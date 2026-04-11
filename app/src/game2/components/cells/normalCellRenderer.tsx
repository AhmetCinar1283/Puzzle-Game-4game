import { Cell } from '../../logic/cellTypes';

export const NormalCellRenderer = ({ cell }: { cell: Cell }) => (
    <div style={{
        width: 64, height: 64,
        background: '#0d1928',
        border: '1px solid rgba(30,58,138,0.25)',
        boxSizing: 'border-box',
        position: 'relative',
    }} />
);
