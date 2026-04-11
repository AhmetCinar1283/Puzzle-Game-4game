import { Cell } from '../../logic/cellTypes';
import { Direction } from '../../logic/types';

const ROTATION: Record<Direction, string> = {
    up: '0deg', right: '90deg', down: '180deg', left: '270deg',
};

export const ConveyorCellRenderer = ({ cell }: { cell: Cell }) => {
    const direction = (cell.customData.direction as Direction) ?? 'up';
    const isPowered = cell.isElectrified;
    const dimmed = !isPowered;

    return (
        <div style={{
            width: 64, height: 64,
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.4)',
            boxShadow: 'inset 0 0 10px rgba(139,92,246,0.15)',
            boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: dimmed ? 0.4 : 1,
        }}>
            <svg
                width={35} height={35}
                viewBox="0 0 24 24"
                fill="none"
                stroke={dimmed ? '#6b4fa0' : '#c4b5fd'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                    transform: `rotate(${ROTATION[direction]})`,
                    filter: dimmed ? 'none' : 'drop-shadow(0 0 5px rgba(196,181,253,0.8))',
                }}
            >
                <path d="M6 21l6-6 6 6" />
                <path d="M6 14l6-6 6 6" />
                <path d="M6 7l6-6 6 6" />
            </svg>
        </div>
    );
};
