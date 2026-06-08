import { Cell } from '../../logic/cellTypes';

import { getPlayerColor } from '../playerColors';

export const TargetCellRenderer = ({ cell }: { cell: Cell }) => {
    const playerIndex = (cell.customData.playerIndex as number) ?? 0;
    const { hex, rgb } = getPlayerColor(playerIndex);
    const cellSize = 64;

    return (
        <div style={{
            width: cellSize,
            height: cellSize,
            background: 'rgba(15, 23, 42, 0.65)',
            border: `2px solid rgba(${rgb}, 0.65)`,
            borderRadius: '10px',
            boxShadow: `inset 0 0 16px rgba(${rgb}, 0.25), 0 0 10px rgba(${rgb}, 0.2)`,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div 
                className="target-rotate-anim" 
                style={{
                    border: `1.5px dashed rgba(${rgb}, 0.45)`,
                }}
            />

            <span
                className="target-pulse-anim"
                style={{
                    fontSize: cellSize * 0.42,
                    lineHeight: 1,
                    color: hex,
                    textShadow: `0 0 10px rgba(${rgb}, 0.8)`,
                    userSelect: 'none',
                    display: 'inline-block',
                    zIndex: 1,
                }}
            >
                ◎
            </span>
        </div>
    );
};