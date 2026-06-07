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
            <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div 
                    style={{
                        width: 38,
                        height: 38,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
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
                        className={isActivelyBouncing ? 'trampoline-spring-active' : undefined}
                        style={{
                            width: '100%',
                            height: '100%',
                            transformOrigin: 'bottom center',
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
