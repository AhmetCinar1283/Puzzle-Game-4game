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
            <div 
                className={isOccupied ? 'power-ring-active' : undefined} 
                style={{
                    position: 'absolute',
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    border: `2px solid ${isOccupied ? 'rgba(251,191,36,0.85)' : 'rgba(251,191,36,0.45)'}`,
                    pointerEvents: 'none',
                }}
            />
            <span 
                className={isOccupied ? 'power-bolt-active' : undefined}
                style={{
                    fontSize: 24,
                    color: isOccupied ? '#fef08a' : '#fbbf24',
                    textShadow: '0 0 10px rgba(251,191,36,0.9), 0 0 20px rgba(251,191,36,0.4)',
                    userSelect: 'none',
                    zIndex: 1,
                    display: 'inline-block',
                }}
            >
                ⚡
            </span>
        </div>
    );
};
