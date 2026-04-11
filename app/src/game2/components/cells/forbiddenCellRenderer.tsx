import { Cell } from '../../logic/cellTypes';

export const ForbiddenCellRenderer = ({ cell }: { cell: Cell }) => (
    <div style={{
        width: 64, height: 64,
        background: 'rgba(220,20,50,0.18)',
        border: '1px solid rgba(255,30,60,0.5)',
        boxShadow: 'inset 0 0 14px rgba(255,0,50,0.25)',
        boxSizing: 'border-box',
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
        {/* Çapraz çizgiler */}
        <div style={{
            position: 'absolute', inset: 0, opacity: 0.25,
            backgroundImage: 'repeating-linear-gradient(45deg, #ff1744 0, #ff1744 1.5px, transparent 0, transparent 50%)',
            backgroundSize: '8px 8px',
        }} />
        <span style={{ fontSize: 20, color: 'rgba(255,60,80,0.7)', userSelect: 'none', position: 'relative', zIndex: 1 }}>
            ✕
        </span>
    </div>
);
