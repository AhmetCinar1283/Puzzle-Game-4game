import { Cell } from '../../logic/cellTypes';

export const ForbiddenCellRenderer = ({ cell }: { cell: Cell }) => (
    <div style={{
        width: 64,
        height: 64,
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1.5px solid #ef4444',
        borderRadius: '6px',
        boxShadow: 'inset 0 0 16px rgba(239,68,68,0.35), 0 0 10px rgba(239,68,68,0.25)',
        boxSizing: 'border-box',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    }}>
        <style>{`
            @keyframes dangerScroll {
                0% { background-position: 0 0; }
                100% { background-position: 28px 0; }
            }
            .forbidden-stripes {
                position: absolute;
                inset: 0;
                opacity: 0.18;
                background-image: linear-gradient(
                    135deg,
                    #ef4444 25%,
                    transparent 25%,
                    transparent 50%,
                    #ef4444 50%,
                    #ef4444 75%,
                    transparent 75%,
                    transparent
                );
                background-size: 20px 20px;
                animation: dangerScroll 1.5s infinite linear;
            }
        `}</style>
        <div className="forbidden-stripes" />
        
        <span style={{ 
            fontSize: 24, 
            color: '#f87171', 
            textShadow: '0 0 10px rgba(239,68,68,0.9), 0 0 20px rgba(239,68,68,0.4)', 
            userSelect: 'none', 
            position: 'relative', 
            zIndex: 1,
            fontWeight: 'bold'
        }}>
            ✕
        </span>
    </div>
);
