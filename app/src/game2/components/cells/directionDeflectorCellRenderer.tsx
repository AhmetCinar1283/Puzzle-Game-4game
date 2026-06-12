import { Cell } from '../../logic/cellTypes';
import { Entity } from '../../logic/entityTypes';
import { Direction } from '../../logic/types';

interface DirectionDeflectorCellRendererProps {
    cell: Cell;
    entityOnCell: Entity | null;
    prevEntityOnCell: Entity | null;
}

const ARROWS: Record<Direction, string> = {
    up: '▲',
    down: '▼',
    left: '◄',
    right: '►',
};

export const DirectionDeflectorCellRenderer = ({ cell, entityOnCell, prevEntityOnCell }: DirectionDeflectorCellRendererProps) => {
    const isOccupied = entityOnCell !== null || prevEntityOnCell !== null;

    const mapping = (cell.customData.mapping as Record<Direction, Direction>) ?? {
        up: 'right', right: 'down', down: 'left', left: 'up'
    };

    return (
        <div 
            id={`cell-${cell.id}`}
            style={{
                width: 64,
                height: 64,
                background: isOccupied ? 'rgba(15, 23, 42, 0.9)' : 'rgba(15, 23, 42, 0.7)',
                border: isOccupied ? '2px solid #fbcfe8' : '2px solid #ec4899',
                borderRadius: '8px',
                boxShadow: isOccupied
                    ? 'inset 0 0 24px rgba(236,72,153,0.75), 0 0 16px rgba(236,72,153,0.5)'
                    : 'inset 0 0 16px rgba(236,72,153,0.25), 0 0 10px rgba(236,72,153,0.2)',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                transition: 'background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease',
            }}
        >
            {/* Center Icon */}
            <span 
                style={{ 
                    fontSize: 22, 
                    color: isOccupied ? '#fbcfe8' : '#f472b6', 
                    textShadow: '0 0 10px rgba(236,72,153,0.9), 0 0 20px rgba(236,72,153,0.4)', 
                    userSelect: 'none', 
                    fontWeight: 'bold',
                    zIndex: 1,
                }}
            >
                ⤭
            </span>

            {/* Top Arrow (Up input) */}
            <div style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#f472b6', fontWeight: 'bold', lineHeight: 1 }}>
                {ARROWS[mapping.up]}
            </div>

            {/* Right Arrow (Right input) */}
            <div style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#f472b6', fontWeight: 'bold', lineHeight: 1 }}>
                {ARROWS[mapping.right]}
            </div>

            {/* Bottom Arrow (Down input) */}
            <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#f472b6', fontWeight: 'bold', lineHeight: 1 }}>
                {ARROWS[mapping.down]}
            </div>

            {/* Left Arrow (Left input) */}
            <div style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#f472b6', fontWeight: 'bold', lineHeight: 1 }}>
                {ARROWS[mapping.left]}
            </div>
        </div>
    );
};
