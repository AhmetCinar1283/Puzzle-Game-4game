import { Cell } from '../../logic/cellTypes';
import { Direction } from '../../logic/types';

const ROTATION: Record<Direction, string> = {
    up: '0deg', right: '90deg', down: '180deg', left: '270deg',
};

export const TrampolineCellRenderer = ({ cell }: { cell: Cell }) => {
    const direction = (cell.customData.direction as Direction) ?? 'up';

    return (
        <div style={{
            width: 64, height: 64,
            background: 'rgba(34,211,238,0.12)',
            border: '2px solid rgba(34,211,238,0.6)',
            boxShadow: 'inset 0 0 14px rgba(34,211,238,0.2), 0 0 8px rgba(34,211,238,0.15)',
            boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <svg
                width={35} height={35}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                    transform: `rotate(${ROTATION[direction]})`,
                    filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.8))',
                }}
            >
                <path d="M12 22V12" />
                <path d="M12 12C12 12 17 16 19 12C21 8 12 2 12 2" />
                <path d="M12 12C12 12 7 16 5 12C3 8 12 2 12 2" />
                <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
        </div>
    );
};
