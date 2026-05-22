import { Cell } from '../../logic/cellTypes';

export const NormalCellRenderer = ({ cell }: { cell: Cell }) => (
    <div style={{
        width: 64,
        height: 64,
        background: 'radial-gradient(circle at center, #111e30 0%, #080f18 100%)',
        border: '1px solid rgba(30,58,138,0.4)',
        boxShadow: 'inset 0 0 6px rgba(0,0,0,0.6), inset 0 0 1px rgba(255,255,255,0.05)',
        boxSizing: 'border-box',
        position: 'relative',
        borderRadius: '2px',
    }}>
        {/* Subtle grid corner tech-dots */}
        <div style={{
            position: 'absolute', top: 3, left: 3, width: 2, height: 2,
            background: 'rgba(59,130,246,0.35)', borderRadius: '50%',
            boxShadow: '0 0 2px rgba(59,130,246,0.6)'
        }} />
        <div style={{
            position: 'absolute', top: 3, right: 3, width: 2, height: 2,
            background: 'rgba(59,130,246,0.35)', borderRadius: '50%',
            boxShadow: '0 0 2px rgba(59,130,246,0.6)'
        }} />
        <div style={{
            position: 'absolute', bottom: 3, left: 3, width: 2, height: 2,
            background: 'rgba(59,130,246,0.35)', borderRadius: '50%',
            boxShadow: '0 0 2px rgba(59,130,246,0.6)'
        }} />
        <div style={{
            position: 'absolute', bottom: 3, right: 3, width: 2, height: 2,
            background: 'rgba(59,130,246,0.35)', borderRadius: '50%',
            boxShadow: '0 0 2px rgba(59,130,246,0.6)'
        }} />
    </div>
);
