import { Cell } from '../../logic/cellTypes';
import { Entity } from '../../logic/entityTypes';

interface ControlSwitchCellRendererProps {
    cell: Cell;
    entityOnCell: Entity | null;
    prevEntityOnCell: Entity | null;
}

export const ControlSwitchCellRenderer = ({ cell, entityOnCell, prevEntityOnCell }: ControlSwitchCellRendererProps) => {
    const isOccupied = entityOnCell !== null || prevEntityOnCell !== null;

    return (
        <div 
            id={`cell-${cell.id}`}
            style={{
                width: 64,
                height: 64,
                background: isOccupied ? 'rgba(15, 23, 42, 0.9)' : 'rgba(15, 23, 42, 0.7)',
                border: isOccupied ? '2px solid #e9d5ff' : '2px solid #a855f7',
                borderRadius: '10px',
                boxShadow: isOccupied
                    ? 'inset 0 0 24px rgba(168,85,247,0.75), 0 0 16px rgba(168,85,247,0.5)'
                    : 'inset 0 0 16px rgba(168,85,247,0.25), 0 0 10px rgba(168,85,247,0.2)',
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
                style={{ 
                    fontSize: 20, 
                    color: isOccupied ? '#e9d5ff' : '#c084fc', 
                    textShadow: '0 0 10px rgba(168,85,247,0.9), 0 0 20px rgba(168,85,247,0.4)', 
                    userSelect: 'none', 
                    fontWeight: 'bold',
                    zIndex: 1
                }}
            >
                ❖
            </span>
            
            {/* Alt tarafta aksiyonun ismini gösteren minik gösterge */}
            <div style={{
                position: 'absolute',
                bottom: 2,
                fontSize: 6,
                fontWeight: 700,
                color: isOccupied ? '#e9d5ff' : '#a855f7',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                opacity: 0.6
            }}>
                {(cell.customData.action as string) ?? 'cycle'}
            </div>
        </div>
    );
};
