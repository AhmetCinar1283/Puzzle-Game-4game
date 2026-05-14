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

const FRAME_MS = 80;
const CELL_SIZE = 64;

const VFX_SOUNDS: Record<string, string> = {
    sound_boing:     '/sounds/boing.mp3',
    sound_ice_break: '/sounds/ice_break.mp3',
};

function playAudio(src: string) {
    new Audio(src).play().catch(() => {});
}

interface GameBoardProps {
    snapshots: TickSnapshot[] | null;
    onAnimationEnd?: () => void;
}

const GameBoard = ({ snapshots, onAnimationEnd }: GameBoardProps) => {
    const [currentFrame, setCurrentFrame] = useState(0);
    const onAnimationEndRef = useRef(onAnimationEnd);
    onAnimationEndRef.current = onAnimationEnd;

    // Yeni snapshot dizisi gelince başa sar (ilk mount hariç)
    const isFirstMount = useRef(true);
    useEffect(() => {
        if (isFirstMount.current) { isFirstMount.current = false; return; }
        setCurrentFrame(0);
    }, [snapshots]);

    // Frame ilerletme — 1 framelık snapshot animasyonu tetiklemez (sadece ekrana çizer)
    useEffect(() => {
        if (!snapshots || snapshots.length === 0) return;
        if (snapshots.length === 1) return; // Başlangıç durumu: animasyon yok

        if (currentFrame >= snapshots.length - 1) {
            onAnimationEndRef.current?.();
            return;
        }

        const timer = setTimeout(() => setCurrentFrame(c => c + 1), FRAME_MS);
        return () => clearTimeout(timer);
    }, [currentFrame, snapshots]);

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
                        return <Renderer key={cell.id} cell={cell} />;
                    })
                )}
            </div>

            {/* Entity katmanı — PhysicsWrapper ile mutlak konumlandırma */}
            <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                {snapshot.entities.map((entity: Entity) => {
                    const Renderer = ENTITY_RENDERERS[entity.type];
                    const currentCell = snapshot.grid[entity.position.row]?.[entity.position.col];
                    return (
                        <PhysicsWrapper
                            key={entity.id}
                            entity={entity}
                            currentCellType={currentCell?.type ?? 'normal'}
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
