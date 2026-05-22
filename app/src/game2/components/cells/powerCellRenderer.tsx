import { Cell } from '../../logic/cellTypes';
import { Entity } from '../../logic/entityTypes';

interface PowerCellRendererProps {
    cell: Cell;
    entityOnCell: Entity | null;
    prevEntityOnCell: Entity | null;
}

export const PowerCellRenderer = ({ cell, entityOnCell, prevEntityOnCell }: PowerCellRendererProps) => {
    // Aktif çalışma modu: hücre üzerinde bir nesne varken VEYA yeni ayrılmışken!
    const isOccupied = entityOnCell !== null || prevEntityOnCell !== null;

    return (
        <div 
            id={`cell-${cell.id}`}
            style={{
                width: 64,
                height: 64,
                background: isOccupied ? 'rgba(15, 23, 42, 0.9)' : 'rgba(15, 23, 42, 0.75)',
                border: isOccupied ? '2px solid #fef08a' : '2px solid #fbbf24',
                borderRadius: '8px',
                boxShadow: isOccupied
                    ? 'inset 0 0 24px rgba(251,191,36,0.75), 0 0 16px rgba(251,191,36,0.55)'
                    : 'inset 0 0 16px rgba(251,191,36,0.3), 0 0 12px rgba(251,191,36,0.25)',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                transition: 'background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease',
            }}
        >
            <style>{`
                @keyframes powerRing-${cell.id} {
                    0% { transform: scale(0.7); opacity: 0.8; }
                    50% { opacity: 0.4; }
                    100% { transform: scale(1.15); opacity: 0; }
                }
                @keyframes boltGlow-${cell.id} {
                    0%, 100% { filter: drop-shadow(0 0 4px rgba(251,191,36,0.85)); transform: scale(1); }
                    50% { filter: drop-shadow(0 0 12px rgba(251,191,36,1)); transform: scale(1.18); }
                }
                #cell-${cell.id} .power-ring {
                    position: absolute;
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    border: 2px solid ${isOccupied ? 'rgba(251,191,36,0.85)' : 'rgba(251,191,36,0.45)'};
                    animation: powerRing-${cell.id} ${isOccupied ? '0.7s' : '2s'} infinite ease-out;
                    pointer-events: none;
                }
                #cell-${cell.id} .power-bolt {
                    animation: boltGlow-${cell.id} ${isOccupied ? '0.5s' : '1.5s'} infinite ease-in-out;
                    font-size: 24px;
                    color: ${isOccupied ? '#fef08a' : '#fbbf24'};
                    text-shadow: 0 0 10px rgba(251,191,36,0.9), 0 0 20px rgba(251,191,36,0.4);
                    user-select: none;
                    z-index: 1;
                    display: inline-block;
                }
            `}</style>
            <div className="power-ring" />
            <span className="power-bolt">
                ⚡
            </span>
        </div>
    );
};
