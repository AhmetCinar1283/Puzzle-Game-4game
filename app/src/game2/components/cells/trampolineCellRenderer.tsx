import { Cell } from '../../logic/cellTypes';
import { Direction } from '../../logic/types';
import { Entity } from '../../logic/entityTypes';
import { useState, useEffect, useRef } from 'react';

const ROTATION: Record<Direction, string> = {
    up: '0deg', right: '90deg', down: '180deg', left: '270deg',
};

interface TrampolineCellRendererProps {
    cell: Cell;
    entityOnCell: Entity | null;
    prevEntityOnCell: Entity | null;
}

export const TrampolineCellRenderer = ({ cell, entityOnCell, prevEntityOnCell }: TrampolineCellRendererProps) => {
    const direction = (cell.customData.direction as Direction) ?? 'up';
    
    const [isActivelyBouncing, setIsActivelyBouncing] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const justArrived = entityOnCell !== null && prevEntityOnCell === null;
        if (justArrived) {
            setIsActivelyBouncing(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                setIsActivelyBouncing(false);
            }, 500);
        }
    }, [entityOnCell?.id, prevEntityOnCell?.id]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return (
        <div 
            id={`cell-${cell.id}`}
            style={{
                width: 64,
                height: 64,
                background: isActivelyBouncing ? 'rgba(15, 23, 42, 0.9)' : 'rgba(15, 23, 42, 0.7)',
                border: `2px solid ${isActivelyBouncing ? '#67e8f9' : '#22d3ee'}`,
                borderRadius: '10px',
                boxShadow: isActivelyBouncing
                    ? 'inset 0 0 24px rgba(34,211,238,0.55), 0 0 16px rgba(34,211,238,0.45)'
                    : 'inset 0 0 16px rgba(34,211,238,0.25), 0 0 10px rgba(34,211,238,0.2)',
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
                @keyframes trampolineLaunch-${cell.id} {
                    0% { transform: scale(1.3, 0.35); filter: brightness(1.6); }
                    40% { transform: scale(0.7, 1.4); filter: brightness(2.0); }
                    70% { transform: scale(1.15, 0.85); }
                    100% { transform: scale(1, 1); }
                }
                #cell-${cell.id} .trampoline-container {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justifyContent: center;
                }
                #cell-${cell.id} .trampoline-spring-wrapper {
                    width: 38px;
                    height: 38px;
                    display: flex;
                    align-items: center;
                    justifyContent: center;
                }
                #cell-${cell.id} .trampoline-spring {
                    width: 100%;
                    height: 100%;
                    transform-origin: bottom center;
                    animation: ${isActivelyBouncing 
                        ? `trampolineLaunch-${cell.id} 500ms cubic-bezier(0.25, 1, 0.5, 1) forwards` 
                        : 'none'};
                }
            `}</style>
            <div className="trampoline-container">
                <div 
                    className="trampoline-spring-wrapper"
                    style={{
                        transform: `rotate(${ROTATION[direction]})`,
                    }}
                >
                    <svg
                        width="100%"
                        height="100%"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={isActivelyBouncing ? '#e0f7fa' : '#22d3ee'}
                        strokeWidth={isActivelyBouncing ? "3.2" : "2.5"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="trampoline-spring"
                        style={{
                            filter: isActivelyBouncing 
                                ? 'drop-shadow(0 0 12px rgba(34,211,238,1))' 
                                : 'drop-shadow(0 0 6px rgba(34,211,238,0.85))',
                            transition: 'stroke-width 200ms ease, stroke 200ms ease, filter 200ms ease',
                        }}
                    >
                        <path d="M12 22V12" />
                        <path d="M12 12C12 12 17 16 19 12C21 8 12 2 12 2" />
                        <path d="M12 12C12 12 7 16 5 12C3 8 12 2 12 2" />
                        <line x1="8" y1="22" x2="16" y2="22" />
                    </svg>
                </div>
            </div>
        </div>
    );
};
