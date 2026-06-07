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
            <span 
                className={isOccupied ? 'toggle-symbol-active' : undefined} 
                style={{ 
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
