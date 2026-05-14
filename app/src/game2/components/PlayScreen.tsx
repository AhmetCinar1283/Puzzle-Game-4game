'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import GameBoard from './GameBoard';
import { Entity } from '../logic/entityTypes';
import { Cell } from '../logic/cellTypes';
import { ActionIntent, Direction, UIEvent, UIButtonType } from '../logic/types';
import { LevelEdges } from '../logic/engine/getNextTopologyPosition';

const KEY_TO_DIRECTION: Record<string, Direction> = {
    ArrowUp:    'up',
    ArrowDown:  'down',
    ArrowLeft:  'left',
    ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
};

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
    up: 'down', down: 'up', left: 'right', right: 'left',
};

const TEXT_COLORS: Record<string, string> = {
    info:    '#00c4ff',
    warning: '#fbbf24',
    success: '#00ff88',
    error:   '#ef4444',
};

const BUTTON_LABELS: Record<UIButtonType, string> = {
    restart:    'Yeniden Başla',
    next_level: 'Sonraki Bölüm',
    menu:       'Menü',
};

interface PlayScreenProps {
    initialEntities: Entity[];
    initialGrid: Cell[][];
    levelEdges?: LevelEdges;
    onMoveExecuted?: (direction: Direction) => void;
    onButtonPressed?: (buttonType: UIButtonType) => void;
}

export function PlayScreen({
    initialEntities,
    initialGrid,
    levelEdges,
    onMoveExecuted,
    onButtonPressed,
}: PlayScreenProps) {
    const {
        snapshots,
        isAnimating,
        isGameOver,
        uiEvents,
        executeTurn,
        onAnimationEnd,
        clearUiEvents,
        getEntities,
    } = useGameEngine({ initialEntities, initialGrid, levelEdges });

    const isAnimatingRef = useRef(isAnimating);
    const isGameOverRef  = useRef(isGameOver);
    isAnimatingRef.current = isAnimating;
    isGameOverRef.current  = isGameOver;

    const handleKey = useCallback((e: KeyboardEvent) => {
        if (isAnimatingRef.current) return;
        if (isGameOverRef.current)  return;
        const rawDirection = KEY_TO_DIRECTION[e.key];
        if (!rawDirection) return;

        e.preventDefault();

        // Her oyuncunun modu (normal/reversed) kontrol edilerek yön belirlenir
        const intents: ActionIntent[] = getEntities()
            .filter(ent => ent.type === 'player')
            .map(ent => {
                const mode = (ent.customData.mode as string) ?? 'normal';
                const direction = mode === 'reversed'
                    ? OPPOSITE_DIRECTION[rawDirection]
                    : rawDirection;
                return {
                    entityId:     ent.id,
                    type:         'mutate_entity' as const,
                    newDirection: direction,
                    newForce:     1,
                };
            });

        if (intents.length > 0) {
            executeTurn(intents);
            onMoveExecuted?.(rawDirection);
        }
    }, [getEntities, executeTurn, onMoveExecuted]);

    useEffect(() => {
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [handleKey]);

    const pendingUi = uiEvents.length > 0 ? uiEvents[uiEvents.length - 1] : null;

    const handleButtonPress = useCallback((buttonType: UIButtonType) => {
        clearUiEvents();
        onButtonPressed?.(buttonType);
    }, [clearUiEvents, onButtonPressed]);

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <GameBoard
                snapshots={snapshots.length > 0 ? snapshots : null}
                onAnimationEnd={onAnimationEnd}
            />

            {isAnimating && (
                <div style={{
                    position: 'absolute', bottom: 8, right: 8,
                    width: 8, height: 8,
                    borderRadius: '50%',
                    background: '#fbbf24',
                    boxShadow: '0 0 6px #fbbf24',
                    pointerEvents: 'none',
                }} />
            )}

            {pendingUi && (
                <UIOverlay event={pendingUi} onButtonPress={handleButtonPress} />
            )}
        </div>
    );
}

function UIOverlay({
    event,
    onButtonPress,
}: {
    event: UIEvent;
    onButtonPress: (buttonType: UIButtonType) => void;
}) {
    const backdrop: React.CSSProperties = {
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: 'rgba(3,7,18,0.78)',
        zIndex: 100,
    };

    if (event.kind === 'text') {
        const color = TEXT_COLORS[event.textType] ?? '#ffffff';
        return (
            <div style={backdrop}>
                <span style={{
                    color,
                    fontSize: 22,
                    fontWeight: 'bold',
                    textShadow: `0 0 18px ${color}`,
                    letterSpacing: '0.04em',
                }}>
                    {event.message}
                </span>
            </div>
        );
    }

    const color = event.buttonType === 'restart' ? '#ef4444' : '#00ff88';
    return (
        <div style={backdrop}>
            <button
                onClick={() => onButtonPress(event.buttonType)}
                style={buttonStyle(color)}
            >
                {event.label ?? BUTTON_LABELS[event.buttonType]}
            </button>
        </div>
    );
}

function buttonStyle(color: string): React.CSSProperties {
    return {
        background:    `rgba(${hexToRgbStr(color)},0.1)`,
        border:        `2px solid ${color}`,
        color,
        padding:       '10px 28px',
        fontSize:      16,
        fontWeight:    'bold',
        cursor:        'pointer',
        letterSpacing: '0.04em',
        boxShadow:     `0 0 14px rgba(${hexToRgbStr(color)},0.35)`,
    };
}

function hexToRgbStr(hex: string): string {
    const map: Record<string, string> = {
        '#00ff88': '0,255,136',
        '#00c4ff': '0,196,255',
        '#ef4444': '239,68,68',
        '#fbbf24': '251,191,36',
    };
    if (map[hex]) return map[hex];
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
}
