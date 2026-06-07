import { Cell } from '../../logic/cellTypes';
import { Direction } from '../../logic/types';
import { Entity } from '../../logic/entityTypes';
import { useState, useEffect, useRef } from 'react';

const ROTATION: Record<Direction, string> = {
    up: '0deg', right: '90deg', down: '180deg', left: '270deg',
};

interface ConveyorCellRendererProps {
    cell: Cell;
    entityOnCell: Entity | null;
    prevEntityOnCell: Entity | null;
}

export const ConveyorCellRenderer = ({ cell, entityOnCell, prevEntityOnCell }: ConveyorCellRendererProps) => {
    const direction = (cell.customData.direction as Direction) ?? 'up';
    const isPowered = cell.isElectrified;
    
    const [isActiveWorking, setIsActiveWorking] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const hasEntity = entityOnCell !== null || prevEntityOnCell !== null;
        if (isPowered && hasEntity) {
            setIsActiveWorking(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                setIsActiveWorking(false);
            }, 800);
        }
    }, [entityOnCell?.id, prevEntityOnCell?.id, isPowered]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const dimmed = !isPowered;

    return (
        <div 
            id={`cell-${cell.id}`}
            style={{
                width: 64, height: 64,
                background: dimmed 
                    ? 'rgba(139,92,246,0.05)' 
                    : isActiveWorking 
                    ? 'rgba(139,92,246,0.22)' 
                    : 'rgba(139,92,246,0.12)',
                border: `1px solid rgba(139,92,246,${dimmed ? 0.25 : isActiveWorking ? 0.8 : 0.5})`,
                boxShadow: dimmed 
                    ? 'inset 0 0 8px rgba(0,0,0,0.4)' 
                    : isActiveWorking
                    ? 'inset 0 0 20px rgba(139,92,246,0.55), 0 0 14px rgba(139,92,246,0.4)'
                    : 'inset 0 0 12px rgba(139,92,246,0.25), 0 0 8px rgba(139,92,246,0.15)',
                boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                transition: 'background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease',
            }}
        >
            <svg
                width={35} height={35}
                viewBox="0 0 24 24"
                fill="none"
                stroke={dimmed ? '#5b3f8a' : isActiveWorking ? '#f5f3ff' : '#c4b5fd'}
                strokeWidth={isActiveWorking ? "3.2" : "2.5"}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                    transform: `rotate(${ROTATION[direction]})`,
                    filter: dimmed ? 'none' : isActiveWorking ? 'drop-shadow(0 0 8px rgba(167,139,250,1))' : 'drop-shadow(0 0 6px rgba(196,181,253,0.85))',
                    transition: 'stroke-width 200ms ease, stroke 200ms ease, filter 200ms ease',
                }}
            >
                <g>
                    <path d="M6 18l6-6 6 6" className={dimmed ? undefined : isActiveWorking ? 'conveyor-arrow-1-active' : undefined} style={{ opacity: 0.4 }} />
                    <path d="M6 12l6-6 6 6" className={dimmed ? undefined : isActiveWorking ? 'conveyor-arrow-2-active' : undefined} style={{ opacity: 1.0 }} />
                    <path d="M6 6l6-6 6 6" className={dimmed ? undefined : isActiveWorking ? 'conveyor-arrow-3-active' : undefined} style={{ opacity: 0.4 }} />
                </g>
            </svg>
        </div>
    );
};
