// components/GameBoard.tsx
// Film oynatıcı — sadece TickSnapshot[] çizer, oyun mantığı içermez.

'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';
import { TickSnapshot, VFXEvent, RoomState, EdgeConfig } from '../logic/types';
import { Cell } from '../logic/cellTypes';
import { Entity } from '../logic/entityTypes';
import { CELL_RENDERERS } from './cells/CELL_RENDERERS';
import { ENTITY_RENDERERS } from './entities/ENTITY_RENDERERS';
import { PhysicsWrapper } from './physicsWrapper';
import { LevelEdges } from '../logic/engine/getNextTopologyPosition';
import { GAME_ANIMATION_KEYFRAMES } from './effects/animationStyles';
import { getPlayerColor } from './playerColors';
import { calculateRoomLayoutOffsets, routePortalPath } from '../logic/engine/rooms';

const CELL_SIZE = 64;

const VFX_SOUNDS: Record<string, string> = {
    sound_move:         '/sounds/move.mp3',
    sound_push:         '/sounds/box_push.flac',
    sound_ice_slide:    '/sounds/ice.mp3',
    sound_ice_break:    '/sounds/ice_break.mp3',
    sound_portal_enter: '/sounds/portal.mp3',
    sound_portal_exit:  '/sounds/teleport.mp3',
    sound_boing:        '/sounds/boing.mp3',
    sound_conveyor:     '/sounds/conveyor.mp3',
    sound_toggle:       '/sounds/toggle.mp3',
    sound_win:          '/sounds/win.mp3',
    sound_lose:         '/sounds/lose.mp3',
};

function playAudio(src: string) {
    new Audio(src).play().catch(() => {});
}

interface GameBoardProps {
    snapshots: TickSnapshot[] | null;
    controlledRoomIds?: string[]; // Aktif/kontrol edilen odalar
    levelEdges?: LevelEdges; // Legacy single-room edge behavior
    onAnimationEnd?: () => void;
}

const edgeStyles = `
    @keyframes lava-flow-horiz {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }
    @keyframes lava-flow-vert {
        0% { background-position: 50% 0%; }
        50% { background-position: 50% 100%; }
        100% { background-position: 50% 0%; }
    }
    @keyframes portal-shift-horiz {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }
    @keyframes portal-shift-vert {
        0% { background-position: 50% 0%; }
        50% { background-position: 50% 100%; }
        100% { background-position: 50% 0%; }
    }
    @keyframes edge-glow-pulse {
        0% { opacity: 0.85; }
        50% { opacity: 1; }
        100% { opacity: 0.85; }
    }
    @keyframes label-breath {
        0% { transform: scale(1); }
        50% { transform: scale(1.15); filter: brightness(1.2); }
        100% { transform: scale(1); }
    }
    @keyframes portal-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    @keyframes crawlPath {
        to { stroke-dashoffset: -20; }
    }
`;

function getEdgePoint(offset: { left: number; top: number; width: number; height: number }, side: 'top' | 'bottom' | 'left' | 'right') {
    switch (side) {
        case 'top':
            return { x: offset.left + offset.width / 2, y: offset.top };
        case 'bottom':
            return { x: offset.left + offset.width / 2, y: offset.top + offset.height };
        case 'left':
            return { x: offset.left, y: offset.top + offset.height / 2 };
        case 'right':
            return { x: offset.left + offset.width, y: offset.top + offset.height / 2 };
    }
}

const GameBoard = ({ snapshots, controlledRoomIds, levelEdges, onAnimationEnd }: GameBoardProps) => {
    const [prevSnapshots, setPrevSnapshots] = useState<TickSnapshot[] | null>(snapshots);
    const [currentFrame, setCurrentFrame] = useState(0);

    if (snapshots !== prevSnapshots) {
        setPrevSnapshots(snapshots);
        const isExtension = prevSnapshots && 
                            prevSnapshots.length > 0 && 
                            snapshots && 
                            snapshots.length > prevSnapshots.length && 
                            prevSnapshots[0] === snapshots[0];
        if (!isExtension) {
            setCurrentFrame(0);
        }
    }

    const onAnimationEndRef = useRef(onAnimationEnd);
    onAnimationEndRef.current = onAnimationEnd;

    const remainingFrames = snapshots ? snapshots.length - 1 - currentFrame : 0;
    const frameMs = snapshots
        ? remainingFrames > 3
            ? Math.max(20, Math.min(80, 240 / remainingFrames))
            : Math.max(50, Math.min(120, 300 / snapshots.length))
        : 80;

    useEffect(() => {
        if (!snapshots || snapshots.length === 0) return;
        if (snapshots.length === 1) return;

        if (currentFrame >= snapshots.length - 1) {
            const finalSnapshot = snapshots[snapshots.length - 1];
            const hasDeath = finalSnapshot?.entities.some(e => e.customData.deathReason) ?? false;
            const hasVictory = finalSnapshot?.entities.some(e => e.customData.isVictory) ?? false;

            if (hasDeath || hasVictory) {
                const timer = setTimeout(() => {
                    onAnimationEndRef.current?.();
                }, 800);
                return () => clearTimeout(timer);
            } else {
                onAnimationEndRef.current?.();
            }
            return;
        }

        let start: number | null = null;
        let animationFrameId: number;

        const step = (timestamp: number) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;

            if (progress >= frameMs) {
                setCurrentFrame(c => c + 1);
            } else {
                animationFrameId = requestAnimationFrame(step);
            }
        };

        animationFrameId = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animationFrameId);
    }, [currentFrame, snapshots, frameMs]);

    useEffect(() => {
        if (!snapshots) return;
        const snapshot = snapshots[currentFrame];
        if (!snapshot) return;
        snapshot.vfxEvents.forEach((vfx: VFXEvent) => {
            if (VFX_SOUNDS[vfx]) playAudio(VFX_SOUNDS[vfx]);
        });
    }, [currentFrame, snapshots]);

    const renderEdgeStrip = (side: 'top' | 'bottom' | 'left' | 'right', behavior?: 'wall' | 'portal' | 'lava' | EdgeConfig) => {
        if (!behavior) return null;

        const ruleType = typeof behavior === 'string' ? behavior : behavior.type;
        const isLava = ruleType === 'lava';
        const isPortal = ruleType === 'portal';
        const isHorizontal = side === 'top' || side === 'bottom';

        const style: React.CSSProperties = {
            position: 'absolute',
            zIndex: 90,
            pointerEvents: 'none',
            ...(side === 'top' && { top: 0, left: 0, right: 0, height: 4 }),
            ...(side === 'bottom' && { bottom: 0, left: 0, right: 0, height: 4 }),
            ...(side === 'left' && { top: 0, bottom: 0, left: 0, width: 4 }),
            ...(side === 'right' && { top: 0, bottom: 0, right: 0, width: 4 }),
        };

        if (isLava) {
            style.background = isHorizontal
                ? 'linear-gradient(90deg, #ef4444, #f97316, #ef4444, #ef4444)'
                : 'linear-gradient(180deg, #ef4444, #f97316, #ef4444, #ef4444)';
            style.backgroundSize = isHorizontal ? '300% 100%' : '100% 300%';
            style.boxShadow = '0 0 10px #ef4444, 0 0 20px rgba(239, 68, 68, 0.5)';
            style.animation = `${isHorizontal ? 'lava-flow-horiz' : 'lava-flow-vert'} 4s infinite linear, edge-glow-pulse 1.5s infinite ease-in-out`;
        } else if (isPortal) {
            style.background = isHorizontal
                ? 'linear-gradient(90deg, #8b5cf6, #ec4899, #8b5cf6, #8b5cf6)'
                : 'linear-gradient(180deg, #8b5cf6, #ec4899, #8b5cf6, #8b5cf6)';
            style.backgroundSize = isHorizontal ? '300% 100%' : '100% 300%';
            style.boxShadow = '0 0 10px #a855f7, 0 0 20px rgba(168, 85, 247, 0.5)';
            style.animation = `${isHorizontal ? 'portal-shift-horiz' : 'portal-shift-vert'} 3s infinite linear, edge-glow-pulse 1.2s infinite ease-in-out`;
        } else {
            style.background = 'rgba(30, 58, 138, 0.4)';
            style.boxShadow = 'none';
        }

        return <div style={style} />;
    };

    const renderEdgeLabel = (side: 'top' | 'bottom' | 'left' | 'right', behavior?: 'wall' | 'portal' | 'lava' | EdgeConfig) => {
        if (!behavior) return null;

        const ruleType = typeof behavior === 'string' ? behavior : behavior.type;
        if (ruleType === 'wall') return null;

        const isLava = ruleType === 'lava';
        const isPortal = ruleType === 'portal';

        const style: React.CSSProperties = {
            position: 'absolute',
            zIndex: 95,
            pointerEvents: 'none',
            fontSize: 14,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            backgroundColor: isLava ? 'rgba(239, 68, 68, 0.15)' : 'rgba(168, 85, 247, 0.15)',
            border: `1px solid ${isLava ? 'rgba(239, 68, 68, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`,
            color: isLava ? '#ef4444' : '#a855f7',
            textShadow: `0 0 6px ${isLava ? '#ef4444' : '#a855f7'}`,
            boxShadow: `0 0 10px ${isLava ? 'rgba(239, 68, 68, 0.1)' : 'rgba(168, 85, 247, 0.1)'}`,
            animation: 'label-breath 2.5s infinite ease-in-out',
            ...(side === 'top' && { top: -28, left: '50%', transform: 'translateX(-50%)' }),
            ...(side === 'bottom' && { bottom: -28, left: '50%', transform: 'translateX(-50%)' }),
            ...(side === 'left' && { left: -28, top: '50%', transform: 'translateY(-50%)' }),
            ...(side === 'right' && { right: -28, top: '50%', transform: 'translateY(-50%)' }),
        };

        const iconStyle: React.CSSProperties = isPortal ? {
            animation: 'portal-spin 6s infinite linear',
            display: 'inline-block',
        } : {};

        return (
            <div style={style}>
                <span style={iconStyle}>
                    {isLava ? '☠' : '🌀'}
                </span>
            </div>
        );
    };

    if (!snapshots || snapshots.length === 0) return null;

    const frameIndex = Math.min(currentFrame, snapshots.length - 1);
    const snapshot = snapshots[frameIndex];
    if (!snapshot) return null;
    const prevSnapshot = frameIndex > 0 ? snapshots[frameIndex - 1] : null;

    // Odaların yerleşim ofsetlerini ve toplam boyutları hesapla
    const { roomPositions, totalWidth, totalHeight } = calculateRoomLayoutOffsets(snapshot.rooms, CELL_SIZE, 40);

    // Bağlantılı portal çizgilerini oluştur
    const connections: { fromRoomId: string; fromSide: 'top' | 'bottom' | 'left' | 'right'; toRoomId: string; toSide: 'top' | 'bottom' | 'left' | 'right' }[] = [];
    const seen = new Set<string>();
    for (const [rId, room] of Object.entries(snapshot.rooms)) {
        for (const side of ['top', 'bottom', 'left', 'right'] as const) {
            const edge = room.edges[side];
            if (edge && edge.type === 'portal' && edge.targetRoomId && edge.targetEdge) {
                const targetRoomId = edge.targetRoomId;
                const targetEdge = edge.targetEdge;

                const connectionKey = [`${rId}:${side}`, `${targetRoomId}:${targetEdge}`].sort().join('--');
                if (seen.has(connectionKey)) continue;
                seen.add(connectionKey);
                connections.push({ fromRoomId: rId, fromSide: side, toRoomId: targetRoomId, toSide: targetEdge });
            }
        }
    }

    const connectionPaths: ReactNode[] = [];
    connections.forEach((conn, connIdx) => {
        const pathD = routePortalPath(
            conn.fromRoomId,
            conn.fromSide,
            conn.toRoomId,
            conn.toSide,
            roomPositions,
            snapshot.rooms,
            CELL_SIZE,
            40, // gap for gameplay
            connIdx,
            connections.length
        );

        connectionPaths.push(
            <g key={`${conn.fromRoomId}-${conn.fromSide}-${conn.toRoomId}-${conn.toSide}`}>
                <path
                    d={pathD}
                    fill="none"
                    stroke="rgba(168, 85, 247, 0.4)"
                    strokeWidth={6}
                    strokeLinecap="round"
                    filter="blur(4px)"
                />
                <path
                    d={pathD}
                    fill="none"
                    stroke="#c084fc"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeDasharray="6, 6"
                    style={{
                        animation: 'crawlPath 1.2s linear infinite',
                    }}
                />
            </g>
        );
    });

    const combinedStyles = edgeStyles + GAME_ANIMATION_KEYFRAMES;

    return (
        <div style={{ position: 'relative', width: totalWidth, height: totalHeight }}>
            <style dangerouslySetInnerHTML={{ __html: combinedStyles }} />

            {/* Portal Bağlantı SVG Overlay */}
            {connectionPaths.length > 0 && (
                <svg
                    style={{
                        position: 'absolute',
                        top: 0, left: 0,
                        width: totalWidth,
                        height: totalHeight,
                        pointerEvents: 'none',
                        zIndex: 80,
                    }}
                >
                    {connectionPaths}
                </svg>
            )}

            {/* Odaların Çizilmesi */}
            {Object.values(snapshot.rooms).map((room: RoomState) => {
                const offset = roomPositions[room.id];
                if (!offset) return null;

                const isControlled = !controlledRoomIds || controlledRoomIds.length === 0 || controlledRoomIds.includes(room.id);

                return (
                    <div
                        key={room.id}
                        style={{
                            position: 'absolute',
                            left: offset.left,
                            top: offset.top,
                            width: offset.width,
                            height: offset.height,
                            boxSizing: 'border-box',
                            transition: 'opacity 0.25s, box-shadow 0.25s',
                            opacity: isControlled ? 1.0 : 0.4,
                            border: '2px solid transparent',
                            boxShadow: isControlled ? '0 0 20px rgba(0, 196, 255, 0.6), inset 0 0 10px rgba(0, 196, 255, 0.3)' : 'none',
                            borderRadius: 6,
                        }}
                    >
                        {/* Oda başlığı */}
                        <div style={{
                            position: 'absolute',
                            top: -20, left: 2,
                            fontSize: 10, fontWeight: 700,
                            color: isControlled ? '#00c4ff' : '#475569',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                        }}>
                            {room.name}
                        </div>

                        {/* Edge Neon Borders & Labels */}
                        {renderEdgeStrip('top', room.edges.top)}
                        {renderEdgeStrip('bottom', room.edges.bottom)}
                        {renderEdgeStrip('left', room.edges.left)}
                        {renderEdgeStrip('right', room.edges.right)}

                        {renderEdgeLabel('top', room.edges.top)}
                        {renderEdgeLabel('bottom', room.edges.bottom)}
                        {renderEdgeLabel('left', room.edges.left)}
                        {renderEdgeLabel('right', room.edges.right)}

                        {/* Grid cells */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${room.width}, ${CELL_SIZE}px)`,
                            width: offset.width - 4, // 2px border offset correction
                            height: offset.height - 4,
                        }}>
                            {room.grid.map((row: Cell[]) =>
                                row.map((cell: Cell) => {
                                    const entityOnCell = snapshot.entities.find(
                                        (e: Entity) => (e.position.roomId ?? 'main') === room.id && e.position.row === cell.position.row && e.position.col === cell.position.col
                                    );
                                    const prevEntityOnCell = prevSnapshot?.entities.find(
                                        (e: Entity) => (e.position.roomId ?? 'main') === room.id && e.position.row === cell.position.row && e.position.col === cell.position.col
                                    );
                                    const Renderer = CELL_RENDERERS[cell.type];
                                    const playersInThisRoom = snapshot.entities.filter((e: Entity) => e.type === 'player' && (e.position.roomId ?? 'main') === room.id && !e.customData._destroyed);
                                    const isCurrentlyVisible = !room.fogOfWar || playersInThisRoom.some(p => Math.sqrt(Math.pow(cell.position.row - p.position.row, 2) + Math.pow(cell.position.col - p.position.col, 2)) <= (room.fogVisibilityDistance ?? 1.5));
                                    const isExplored = !room.fogOfWar || (room.fogKeepRevealed !== false ? !!cell.customData.explored : isCurrentlyVisible);

                                    if (!isExplored) {
                                        return (
                                            <div key={cell.id} style={{ width: CELL_SIZE, height: CELL_SIZE, backgroundColor: '#020617', border: '1px solid rgba(30, 58, 138, 0.05)', boxSizing: 'border-box' }} />
                                        );
                                    }

                                    const visibleEntityOnCell = isCurrentlyVisible ? entityOnCell : (entityOnCell?.type === 'player' ? entityOnCell : null);
                                    const visiblePrevEntityOnCell = isCurrentlyVisible ? prevEntityOnCell : (prevEntityOnCell?.type === 'player' ? prevEntityOnCell : null);

                                    // Custom renderer fallback
                                    const ActiveRenderer = Renderer || CELL_RENDERERS['normal'];
                                    return (
                                        <div key={cell.id} style={{ position: 'relative', width: CELL_SIZE, height: CELL_SIZE, backgroundColor: '#020617' }}>
                                            <div style={{ width: '100%', height: '100%', filter: isCurrentlyVisible ? 'none' : 'brightness(0.3) contrast(0.8)', transition: 'filter 0.3s ease' }}>
                                                <ActiveRenderer 
                                                    cell={cell} 
                                                    entityOnCell={visibleEntityOnCell}
                                                    prevEntityOnCell={visiblePrevEntityOnCell}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Trail Layer */}
            <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: totalWidth, height: totalHeight }}>
                {Object.values(snapshot.rooms).map((room: RoomState) => {
                    const offset = roomPositions[room.id];
                    if (!offset) return null;

                    return room.grid.map((row: Cell[]) =>
                        row.map((cell: Cell) => {
                            const trailPlayerIndex = cell.customData.trailPlayerIndex as number | undefined;
                            if (trailPlayerIndex === undefined) return null;

                            const playersInThisRoom = snapshot.entities.filter((e: Entity) => e.type === 'player' && (e.position.roomId ?? 'main') === room.id && !e.customData._destroyed);
                            const isCurrentlyVisible = !room.fogOfWar || playersInThisRoom.some(p => Math.sqrt(Math.pow(cell.position.row - p.position.row, 2) + Math.pow(cell.position.col - p.position.col, 2)) <= (room.fogVisibilityDistance ?? 1.5));
                            const isExplored = !room.fogOfWar || (room.fogKeepRevealed !== false ? !!cell.customData.explored : isCurrentlyVisible);

                            if (!isExplored) return null;

                            const { hex: color, glow } = getPlayerColor(trailPlayerIndex);
                            const r = cell.position.row;
                            const c = cell.position.col;

                            const hasLeft  = room.grid[r]?.[c - 1]?.customData.trailPlayerIndex === trailPlayerIndex;
                            const hasRight = room.grid[r]?.[c + 1]?.customData.trailPlayerIndex === trailPlayerIndex;
                            const hasUp    = room.grid[r - 1]?.[c]?.customData.trailPlayerIndex === trailPlayerIndex;
                            const hasDown  = room.grid[r + 1]?.[c]?.customData.trailPlayerIndex === trailPlayerIndex;

                            const player = snapshot.entities.find((e: Entity) => 
                                e.type === 'player' && 
                                !e.customData._destroyed && 
                                (e.customData.playerIndex as number) === trailPlayerIndex
                            );
                            
                            const isPlayerLeft  = player && player.position.row === r && player.position.col === c - 1;
                            const isPlayerRight = player && player.position.row === r && player.position.col === c + 1;
                            const isPlayerUp    = player && player.position.row === r - 1 && player.position.col === c;
                            const isPlayerDown  = player && player.position.row === r + 1 && player.position.col === c;

                            return (
                                <div 
                                    key={`trail-${cell.id}`}
                                    style={{
                                        position: 'absolute',
                                        top: offset.top + r * CELL_SIZE,
                                        left: offset.left + c * CELL_SIZE,
                                        width: CELL_SIZE,
                                        height: CELL_SIZE,
                                        pointerEvents: 'none',
                                        zIndex: 5,
                                        opacity: isCurrentlyVisible ? 1.0 : 0.2,
                                        transition: 'opacity 0.3s ease',
                                    }}
                                >
                                    {(hasLeft || isPlayerLeft) && (
                                        <div style={{
                                            position: 'absolute', left: 0, top: 29, width: 32, height: 6,
                                            backgroundColor: color, boxShadow: `0 0 8px ${color}, 0 0 16px ${glow}`,
                                        }} />
                                    )}
                                    {(hasRight || isPlayerRight) && (
                                        <div style={{
                                            position: 'absolute', left: 32, top: 29, width: 32, height: 6,
                                            backgroundColor: color, boxShadow: `0 0 8px ${color}, 0 0 16px ${glow}`,
                                        }} />
                                    )}
                                    {(hasUp || isPlayerUp) && (
                                        <div style={{
                                            position: 'absolute', left: 29, top: 0, width: 6, height: 32,
                                            backgroundColor: color, boxShadow: `0 0 8px ${color}, 0 0 16px ${glow}`,
                                        }} />
                                    )}
                                    {(hasDown || isPlayerDown) && (
                                        <div style={{
                                            position: 'absolute', left: 29, top: 32, width: 6, height: 32,
                                            backgroundColor: color, boxShadow: `0 0 8px ${color}, 0 0 16px ${glow}`,
                                        }} />
                                    )}
                                    <div style={{
                                        position: 'absolute', left: 25, top: 25, width: 14, height: 14,
                                        borderRadius: '50%', backgroundColor: '#ffffff', border: `3px solid ${color}`,
                                        boxShadow: `0 0 10px ${color}, 0 0 20px ${color}`, zIndex: 6,
                                    }} />
                                </div>
                            );
                        })
                    );
                })}
            </div>

            {/* Cable Layer */}
            <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: totalWidth, height: totalHeight }}>
                {Object.values(snapshot.rooms).map((room: RoomState) => {
                    const offset = roomPositions[room.id];
                    if (!offset) return null;

                    return room.grid.map((row: Cell[]) =>
                        row.map((cell: Cell) => {
                            const isElectrified = cell.isElectrified || cell.type === 'power';
                            if (!isElectrified) return null;

                            const playersInThisRoom = snapshot.entities.filter((e: Entity) => e.type === 'player' && (e.position.roomId ?? 'main') === room.id && !e.customData._destroyed);
                            const isCurrentlyVisible = !room.fogOfWar || playersInThisRoom.some(p => Math.sqrt(Math.pow(cell.position.row - p.position.row, 2) + Math.pow(cell.position.col - p.position.col, 2)) <= (room.fogVisibilityDistance ?? 1.5));
                            const isExplored = !room.fogOfWar || (room.fogKeepRevealed !== false ? !!cell.customData.explored : isCurrentlyVisible);

                            if (!isExplored) return null;

                            const cableConns = (cell.customData.cableConnections as string[]) ?? [];
                            const hasRightConnection = cableConns.includes('right');
                            const hasDownConnection = cableConns.includes('down');

                            const r = cell.position.row;
                            const c = cell.position.col;

                            // Check right neighbor
                            const rightCell = room.grid[r]?.[c + 1];
                            const isRightExplored = rightCell && (!room.fogOfWar || (room.fogKeepRevealed !== false ? !!rightCell.customData.explored : (!room.fogOfWar || playersInThisRoom.some(p => Math.sqrt(Math.pow(rightCell.position.row - p.position.row, 2) + Math.pow(rightCell.position.col - p.position.col, 2)) <= (room.fogVisibilityDistance ?? 1.5)))));

                            // Check down neighbor
                            const downCell = room.grid[r + 1]?.[c];
                            const isDownExplored = downCell && (!room.fogOfWar || (room.fogKeepRevealed !== false ? !!downCell.customData.explored : (!room.fogOfWar || playersInThisRoom.some(p => Math.sqrt(Math.pow(downCell.position.row - p.position.row, 2) + Math.pow(downCell.position.col - p.position.col, 2)) <= (room.fogVisibilityDistance ?? 1.5)))));

                            return (
                                <div 
                                    key={`cable-${cell.id}`}
                                    style={{
                                        position: 'absolute',
                                        top: offset.top + r * CELL_SIZE,
                                        left: offset.left + c * CELL_SIZE,
                                        width: CELL_SIZE,
                                        height: CELL_SIZE,
                                        pointerEvents: 'none',
                                        zIndex: 6,
                                        opacity: isCurrentlyVisible ? 0.65 : 0.15,
                                        transition: 'opacity 0.3s ease',
                                    }}
                                >
                                    {/* Connection to the right */}
                                    {hasRightConnection && isRightExplored && (
                                        <div style={{
                                            position: 'absolute',
                                            left: 32,
                                            top: 31, // center-aligned for height 2px
                                            width: 64,
                                            height: 2,
                                            backgroundColor: 'rgba(251, 191, 36, 0.85)',
                                            boxShadow: '0 0 4px rgba(234, 179, 8, 0.6)',
                                        }} />
                                    )}

                                    {/* Connection down */}
                                    {hasDownConnection && isDownExplored && (
                                        <div style={{
                                            position: 'absolute',
                                            left: 31, // center-aligned for width 2px
                                            top: 32,
                                            width: 2,
                                            height: 64,
                                            backgroundColor: 'rgba(251, 191, 36, 0.85)',
                                            boxShadow: '0 0 4px rgba(234, 179, 8, 0.6)',
                                        }} />
                                    )}

                                    {/* Center Node/Junction */}
                                    <div style={{
                                        position: 'absolute',
                                        left: 30,
                                        top: 30,
                                        width: 4,
                                        height: 4,
                                        borderRadius: '50%',
                                        backgroundColor: '#ffffff',
                                        boxShadow: '0 0 4px rgba(234, 179, 8, 0.8)',
                                        zIndex: 7,
                                    }} />
                                </div>
                            );
                        })
                    );
                })}
            </div>

            {/* Entity Layer */}
            <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                {snapshot.entities.map((entity: Entity) => {
                    const Renderer = ENTITY_RENDERERS[entity.type];
                    const rId = entity.position.roomId ?? 'main';
                    const currentCell = snapshot.rooms[rId]?.grid[entity.position.row]?.[entity.position.col];
                    const prevSnapshot = frameIndex > 0 ? snapshots[frameIndex - 1] : null;
                    const prevEntity = prevSnapshot?.entities.find(e => e.id === entity.id) ?? null;
                    
                    const room = snapshot.rooms[rId];
                    const playersInRoom = snapshot.entities.filter(e => e.type === 'player' && (e.position.roomId ?? 'main') === rId && !e.customData._destroyed);
                    const isEntityVisible = !room?.fogOfWar || entity.type === 'player' || (
                        playersInRoom.some(p => 
                            Math.sqrt(Math.pow(entity.position.row - p.position.row, 2) + Math.pow(entity.position.col - p.position.col, 2)) <= (room.fogVisibilityDistance ?? 1.5)
                        )
                    );
                    const isEntityExplored = !room?.fogOfWar || (room.fogKeepRevealed !== false ? !!currentCell?.customData.explored : isEntityVisible);

                    const opacity = (isEntityExplored && isEntityVisible) ? 1.0 : 0.0;

                    return (
                        <PhysicsWrapper
                            key={entity.id}
                            entity={entity}
                            prevEntity={prevEntity}
                            currentCellType={currentCell?.type ?? 'normal'}
                            frameMs={frameMs}
                            roomOffsets={roomPositions}
                        >
                            <div style={{ opacity, transition: 'opacity 0.3s ease', width: '100%', height: '100%' }}>
                                <Renderer entity={entity} />
                            </div>
                        </PhysicsWrapper>
                    );
                })}
            </div>
        </div>
    );
};

export default GameBoard;
