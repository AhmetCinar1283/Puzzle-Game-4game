import { Cell } from '../../logic/cellTypes';
import { Entity } from '../../logic/entityTypes';
import { useState, useEffect, useRef } from 'react';

type TeleportGroup = 'A' | 'B' | 'C';

const GROUP_COLOR: Record<TeleportGroup, string> = {
    A: '#ec4899', // Pembe
    B: '#f97316', // Turuncu
    C: '#14b8a6', // Teal
};

interface TeleportCellRendererProps {
    cell: Cell;
    entityOnCell: Entity | null;
    prevEntityOnCell: Entity | null;
}

export const TeleportCellRenderer = ({ cell, entityOnCell, prevEntityOnCell }: TeleportCellRendererProps) => {
    const group = (cell.customData.group as TeleportGroup) ?? 'A';
    const isIn  = (cell.customData.isIn as boolean) ?? true;
    const color = GROUP_COLOR[group];
    const rgb = hexToRgb(color);

    const [isActivelyTeleporting, setIsActivelyTeleporting] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const justArrived = entityOnCell !== null && prevEntityOnCell === null;
        const justLeft = entityOnCell === null && prevEntityOnCell !== null;

        if (justArrived || justLeft) {
            setIsActivelyTeleporting(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                setIsActivelyTeleporting(false);
            }, 600);
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
                background: isActivelyTeleporting 
                    ? (isIn ? 'rgba(236, 72, 153, 0.25)' : 'rgba(20, 184, 166, 0.25)') 
                    : 'rgba(15, 23, 42, 0.7)',
                border: `2px solid rgba(${rgb}, ${isActivelyTeleporting ? 1.0 : isIn ? 0.7 : 0.4})`,
                borderRadius: '12px',
                boxShadow: isActivelyTeleporting
                    ? `inset 0 0 24px rgba(${rgb}, 0.7), 0 0 16px rgba(${rgb}, 0.5)`
                    : isIn
                    ? `inset 0 0 16px rgba(${rgb}, 0.3), 0 0 10px rgba(${rgb}, 0.2)`
                    : `inset 0 0 12px rgba(${rgb}, 0.15), 0 0 4px rgba(${rgb}, 0.1)`,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                transition: 'background-color 600ms ease, border-color 600ms ease, box-shadow 600ms ease',
            }}
        >
            <div 
                className={isActivelyTeleporting ? 'portal-pulse-ring-active' : undefined}
                style={{
                    position: 'absolute',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    border: `2px solid rgba(${rgb}, ${isActivelyTeleporting ? 0.95 : 0.4})`,
                    pointerEvents: 'none',
                    transition: 'border-color 600ms ease',
                }}
            />

            {/* Dış girdap için pürüzsüz ölçekleme katmanı */}
            <div
                style={{
                    position: 'absolute',
                    width: 44,
                    height: 44,
                    transform: isActivelyTeleporting ? 'scale(1.4)' : 'scale(1.0)',
                    opacity: isActivelyTeleporting ? 1.0 : 0.65,
                    filter: isActivelyTeleporting ? `drop-shadow(0 0 12px ${color})` : 'none',
                    transition: 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1), opacity 600ms ease, filter 600ms ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                }}
            >
                <div 
                    className={isActivelyTeleporting ? 'portal-vortex-active' : undefined} 
                    style={{ 
                        width: '100%', 
                        height: '100%',
                        borderRadius: '50%',
                        border: `2px dashed rgba(${rgb}, 0.7)`,
                        borderTopColor: 'transparent',
                        borderBottomColor: 'transparent',
                        pointerEvents: 'none',
                    }} 
                />
            </div>

            {/* İç girdap için pürüzsüz ölçekleme katmanı */}
            <div
                style={{
                    position: 'absolute',
                    width: 28,
                    height: 28,
                    transform: isActivelyTeleporting ? 'scale(1.4)' : 'scale(1.0)',
                    opacity: isActivelyTeleporting ? 1.0 : 0.45,
                    transition: 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1), opacity 600ms ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                }}
            >
                <div 
                    className={isActivelyTeleporting ? 'portal-vortex-inner-active' : undefined} 
                    style={{ 
                        width: '100%', 
                        height: '100%',
                        borderRadius: '50%',
                        border: `2px dotted rgba(${rgb}, 0.5)`,
                        borderLeftColor: 'transparent',
                        pointerEvents: 'none',
                    }} 
                />
            </div>

            <div style={{
                position: 'relative',
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
            }}>
                <span style={{ fontSize: 13, color, textShadow: `0 0 6px ${color}`, userSelect: 'none', fontWeight: 'bold', lineHeight: 1 }}>
                    {group}
                </span>
                <span style={{ fontSize: 9, color, opacity: 0.8, textShadow: `0 0 4px ${color}`, userSelect: 'none', fontWeight: 'bold', marginTop: 2 }}>
                    {isIn ? '↑' : '↓'}
                </span>
            </div>
        </div>
    );
};

// #rrggbb → "r,g,b" (rgba() için)
function hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
}
