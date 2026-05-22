import { Cell } from '../../logic/cellTypes';
import { Entity } from '../../logic/entityTypes';

interface ToggleCellRendererProps {
    cell: Cell;
    entityOnCell: Entity | null;
    prevEntityOnCell: Entity | null;
}

export const ToggleCellRenderer = ({ cell, entityOnCell, prevEntityOnCell }: ToggleCellRendererProps) => {
    // Aktif çalışma modu: hücre üzerinde bir nesne varken VEYA yeni ayrılmışken!
    const isOccupied = entityOnCell !== null || prevEntityOnCell !== null;

    return (
        <div 
            id={`cell-${cell.id}`}
            style={{
                width: 64,
                height: 64,
                background: isOccupied ? 'rgba(15, 23, 42, 0.9)' : 'rgba(15, 23, 42, 0.7)',
                border: isOccupied ? '2px solid #fef08a' : '2px solid #fbbf24',
                borderRadius: '8px',
                boxShadow: isOccupied
                    ? 'inset 0 0 24px rgba(251,191,36,0.75), 0 0 16px rgba(251,191,36,0.5)'
                    : 'inset 0 0 16px rgba(251,191,36,0.25), 0 0 10px rgba(251,191,36,0.2)',
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
                @keyframes togglePulse-${cell.id} {
                    0% { opacity: 0.65; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.08); }
                    100% { opacity: 0.65; transform: scale(1); }
                }
                @keyframes toggleActive-${cell.id} {
                    0% { transform: scale(1) rotate(0deg); opacity: 0.7; }
                    50% { transform: scale(1.25) rotate(180deg); opacity: 1; }
                    100% { transform: scale(1) rotate(360deg); opacity: 0.7; }
                }
                #cell-${cell.id} .toggle-symbol {
                    animation: ${isOccupied ? `toggleActive-${cell.id} 0.6s infinite linear` : `togglePulse-${cell.id} 2s infinite ease-in-out`};
                    display: inline-block;
                }
            `}</style>
            <span className="toggle-symbol" style={{ 
                fontSize: 22, 
                color: isOccupied ? '#fef08a' : '#fbbf24', 
                textShadow: '0 0 10px rgba(251,191,36,0.9), 0 0 20px rgba(251,191,36,0.4)', 
                userSelect: 'none', 
                fontWeight: 'bold',
                zIndex: 1
            }}>
                ⇄
            </span>
        </div>
    );
};
