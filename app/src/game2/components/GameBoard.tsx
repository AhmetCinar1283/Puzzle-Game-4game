// components/GameBoard.tsx
// Film oynatıcı — sadece TickSnapshot[] çizer, oyun mantığı içermez.
//
// SORUMLULUK:
//   • Grid hücrelerini CELL_RENDERERS ile çizmek
//   • Entity'leri PhysicsWrapper içinde ENTITY_RENDERERS ile çizmek
//   • Snapshot'ları FRAME_MS aralıkla ilerletmek
//   • VFX seslerini çalmak
//   • Animasyon bitince onAnimationEnd callback'ini çağırmak

'use client';

import { useEffect, useRef, useState } from 'react';
import { TickSnapshot, VFXEvent } from '../logic/types';
import { Cell } from '../logic/cellTypes';
import { Entity } from '../logic/entityTypes';
import { CELL_RENDERERS } from './cells/CELL_RENDERERS';
import { ENTITY_RENDERERS } from './entities/ENTITY_RENDERERS';
import { PhysicsWrapper } from './physicsWrapper';
import { LevelEdges } from '../logic/engine/getNextTopologyPosition';
import { GAME_ANIMATION_KEYFRAMES } from './effects/animationStyles';
import { getPlayerColor } from './playerColors';

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
    levelEdges?: LevelEdges;
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
`;

const GameBoard = ({ snapshots, levelEdges, onAnimationEnd }: GameBoardProps) => {
    const [prevSnapshots, setPrevSnapshots] = useState<TickSnapshot[] | null>(snapshots);
    const [currentFrame, setCurrentFrame] = useState(0);

    // Yeni snapshot dizisi gelince başa sar veya uzantısı ise kaldığı yerden devam et
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

    // Kalan kare sayısına göre dinamik hızlanma (catch-up) hesabı
    const remainingFrames = snapshots ? snapshots.length - 1 - currentFrame : 0;
    const frameMs = snapshots
        ? remainingFrames > 3
            ? Math.max(20, Math.min(80, 240 / remainingFrames))
            : Math.max(50, Math.min(120, 300 / snapshots.length))
        : 80;

    // Frame ilerletme — 1 framelik snapshot animasyonu tetiklemez (sadece ekrana çizer)
    // requestAnimationFrame ile 60fps akıcılık ve mobil tarayıcı performansı
    useEffect(() => {
        if (!snapshots || snapshots.length === 0) return;
        if (snapshots.length === 1) return; // Başlangıç durumu: animasyon yok

        if (currentFrame >= snapshots.length - 1) {
            // Son frame'e ulaşıldı. Bu frame'de bir ölüm veya zafer varsa animasyonunun tamamlanması için bekle
            const finalSnapshot = snapshots[snapshots.length - 1];
            const hasDeath = finalSnapshot?.entities.some(e => e.customData.deathReason) ?? false;
            const hasVictory = finalSnapshot?.entities.some(e => e.customData.isVictory) ?? false;

            if (hasDeath || hasVictory) {
                const timer = setTimeout(() => {
                    onAnimationEndRef.current?.();
                }, 800); // 800ms ölüm/zafer animasyonu için bekle
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

    // VFX ses çalma
    useEffect(() => {
        if (!snapshots) return;
        const snapshot = snapshots[currentFrame];
        if (!snapshot) return;
        snapshot.vfxEvents.forEach((vfx: VFXEvent) => {
            if (VFX_SOUNDS[vfx]) playAudio(VFX_SOUNDS[vfx]);
        });
    }, [currentFrame, snapshots]);

    const renderEdgeStrip = (side: 'top' | 'bottom' | 'left' | 'right', behavior?: 'wall' | 'portal' | 'lava') => {
        if (!behavior) return null;

        const isLava = behavior === 'lava';
        const isPortal = behavior === 'portal';
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

    const renderEdgeLabel = (side: 'top' | 'bottom' | 'left' | 'right', behavior?: 'wall' | 'portal' | 'lava') => {
        if (!behavior || behavior === 'wall') return null;

        const isLava = behavior === 'lava';
        const isPortal = behavior === 'portal';

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

    const rows = snapshot.grid.length;
    const cols = snapshot.grid[0]?.length ?? 0;
    const boardWidth  = cols * CELL_SIZE;
    const boardHeight = rows * CELL_SIZE;

    const combinedStyles = edgeStyles + GAME_ANIMATION_KEYFRAMES;

    return (
        <div style={{ position: 'relative', width: boardWidth, height: boardHeight }}>
            <style dangerouslySetInnerHTML={{ __html: combinedStyles }} />

            {/* Edge neon border strips & animated labels */}
            {levelEdges && (
                <>
                    {renderEdgeStrip('top', levelEdges.top)}
                    {renderEdgeStrip('bottom', levelEdges.bottom)}
                    {renderEdgeStrip('left', levelEdges.left)}
                    {renderEdgeStrip('right', levelEdges.right)}

                    {renderEdgeLabel('top', levelEdges.top)}
                    {renderEdgeLabel('bottom', levelEdges.bottom)}
                    {renderEdgeLabel('left', levelEdges.left)}
                    {renderEdgeLabel('right', levelEdges.right)}
                </>
            )}

            {/* Hücre katmanı */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
                width: boardWidth,
                height: boardHeight,
            }}>
                {snapshot.grid.map((row: Cell[]) =>
                    row.map((cell: Cell) => {
                        const Renderer = CELL_RENDERERS[cell.type];
                        const prevSnapshot = frameIndex > 0 ? snapshots[frameIndex - 1] : null;
                        const entityOnCell = snapshot.entities.find(e => e.position.row === cell.position.row && e.position.col === cell.position.col) ?? null;
                        const prevEntityOnCell = prevSnapshot?.entities.find(e => e.position.row === cell.position.row && e.position.col === cell.position.col) ?? null;
                        return (
                            <Renderer 
                                key={cell.id} 
                                cell={cell} 
                                entityOnCell={entityOnCell}
                                prevEntityOnCell={prevEntityOnCell}
                            />
                        );
                    })
                )}
            </div>

            {/* Trail Katmanı ── Fütüristik Neon İzler */}
            <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: boardWidth, height: boardHeight }}>
                {snapshot.grid.map((row: Cell[]) =>
                    row.map((cell: Cell) => {
                        const trailPlayerIndex = cell.customData.trailPlayerIndex as number | undefined;
                        if (trailPlayerIndex === undefined) return null;

                        const { hex: color, glow } = getPlayerColor(trailPlayerIndex);

                        const r = cell.position.row;
                        const c = cell.position.col;

                        // Komşu hücrelerin iz durumlarını kontrol et
                        const hasLeft  = snapshot.grid[r]?.[c - 1]?.customData.trailPlayerIndex === trailPlayerIndex;
                        const hasRight = snapshot.grid[r]?.[c + 1]?.customData.trailPlayerIndex === trailPlayerIndex;
                        const hasUp    = snapshot.grid[r - 1]?.[c]?.customData.trailPlayerIndex === trailPlayerIndex;
                        const hasDown  = snapshot.grid[r + 1]?.[c]?.customData.trailPlayerIndex === trailPlayerIndex;

                        // Oyuncunun asıl konumuna kusursuz bağlantı sağla
                        const player = snapshot.entities.find(e => e.type === 'player' && !e.customData._destroyed && ((e.customData.playerIndex as number) ?? 0) === trailPlayerIndex);
                        const isPlayerLeft  = player && player.position.row === r && player.position.col === c - 1;
                        const isPlayerRight = player && player.position.row === r && player.position.col === c + 1;
                        const isPlayerUp    = player && player.position.row === r - 1 && player.position.col === c;
                        const isPlayerDown  = player && player.position.row === r + 1 && player.position.col === c;

                        return (
                            <div 
                                key={`trail-${cell.id}`}
                                style={{
                                    position: 'absolute',
                                    top: r * CELL_SIZE,
                                    left: c * CELL_SIZE,
                                    width: CELL_SIZE,
                                    height: CELL_SIZE,
                                    pointerEvents: 'none',
                                    zIndex: 5,
                                }}
                            >
                                {/* Sol bağlantı çizgisi */}
                                {(hasLeft || isPlayerLeft) && (
                                    <div style={{
                                        position: 'absolute',
                                        left: 0,
                                        top: 29,
                                        width: 32,
                                        height: 6,
                                        backgroundColor: color,
                                        boxShadow: `0 0 8px ${color}, 0 0 16px ${glow}`,
                                    }} />
                                )}

                                {/* Sağ bağlantı çizgisi */}
                                {(hasRight || isPlayerRight) && (
                                    <div style={{
                                        position: 'absolute',
                                        left: 32,
                                        top: 29,
                                        width: 32,
                                        height: 6,
                                        backgroundColor: color,
                                        boxShadow: `0 0 8px ${color}, 0 0 16px ${glow}`,
                                    }} />
                                )}

                                {/* Yukarı bağlantı çizgisi */}
                                {(hasUp || isPlayerUp) && (
                                    <div style={{
                                        position: 'absolute',
                                        left: 29,
                                        top: 0,
                                        width: 6,
                                        height: 32,
                                        backgroundColor: color,
                                        boxShadow: `0 0 8px ${color}, 0 0 16px ${glow}`,
                                    }} />
                                )}

                                {/* Aşağı bağlantı çizgisi */}
                                {(hasDown || isPlayerDown) && (
                                    <div style={{
                                        position: 'absolute',
                                        left: 29,
                                        top: 32,
                                        width: 6,
                                        height: 32,
                                        backgroundColor: color,
                                        boxShadow: `0 0 8px ${color}, 0 0 16px ${glow}`,
                                    }} />
                                )}

                                {/* Merkezdeki parlak lazer düğümü / yuvarlak (parlak beyaz çekirdekli neon) */}
                                <div style={{
                                    position: 'absolute',
                                    left: 25,
                                    top: 25,
                                    width: 14,
                                    height: 14,
                                    borderRadius: '50%',
                                    backgroundColor: '#ffffff',
                                    border: `3px solid ${color}`,
                                    boxShadow: `0 0 10px ${color}, 0 0 20px ${color}`,
                                    zIndex: 6,
                                }} />
                            </div>
                        );
                    })
                )}
            </div>

            {/* Entity katmanı — PhysicsWrapper ile mutlak konumlandırma */}
            <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                {snapshot.entities.map((entity: Entity) => {
                    const Renderer = ENTITY_RENDERERS[entity.type];
                    const currentCell = snapshot.grid[entity.position.row]?.[entity.position.col];
                    const prevSnapshot = frameIndex > 0 ? snapshots[frameIndex - 1] : null;
                    const prevEntity = prevSnapshot?.entities.find(e => e.id === entity.id) ?? null;
                    return (
                        <PhysicsWrapper
                            key={entity.id}
                            entity={entity}
                            prevEntity={prevEntity}
                            currentCellType={currentCell?.type ?? 'normal'}
                            frameMs={frameMs}
                        >
                            <Renderer entity={entity} />
                        </PhysicsWrapper>
                    );
                })}
            </div>
        </div>
    );
};

export default GameBoard;
