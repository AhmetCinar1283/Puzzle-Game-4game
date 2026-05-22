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
    onAnimationEnd?: () => void;
}

const GameBoard = ({ snapshots, onAnimationEnd }: GameBoardProps) => {
    const [prevSnapshots, setPrevSnapshots] = useState<TickSnapshot[] | null>(snapshots);
    const [currentFrame, setCurrentFrame] = useState(0);

    // Yeni snapshot dizisi gelince başa sar (Render-phase state adjustment)
    if (snapshots !== prevSnapshots) {
        setPrevSnapshots(snapshots);
        setCurrentFrame(0);
    }

    const onAnimationEndRef = useRef(onAnimationEnd);
    onAnimationEndRef.current = onAnimationEnd;

    // Toplam animasyon süresini ~300ms ile sınırlamak için dinamik kare süresi hesaplaması
    const frameMs = snapshots
        ? Math.max(50, Math.min(120, 300 / snapshots.length))
        : 80;

    // Frame ilerletme — 1 framelik snapshot animasyonu tetiklemez (sadece ekrana çizer)
    useEffect(() => {
        if (!snapshots || snapshots.length === 0) return;
        if (snapshots.length === 1) return; // Başlangıç durumu: animasyon yok

        if (currentFrame >= snapshots.length - 1) {
            onAnimationEndRef.current?.();
            return;
        }

        const timer = setTimeout(() => setCurrentFrame(c => c + 1), frameMs);
        return () => clearTimeout(timer);
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

    if (!snapshots || snapshots.length === 0) return null;

    const frameIndex = Math.min(currentFrame, snapshots.length - 1);
    const snapshot = snapshots[frameIndex];
    if (!snapshot) return null;

    const rows = snapshot.grid.length;
    const cols = snapshot.grid[0]?.length ?? 0;
    const boardWidth  = cols * CELL_SIZE;
    const boardHeight = rows * CELL_SIZE;

    return (
        <div style={{ position: 'relative', width: boardWidth, height: boardHeight }}>

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
