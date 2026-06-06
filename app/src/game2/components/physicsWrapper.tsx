// components/PhysicsWrapper.tsx
// KOZMETİK SARMALAYICI — fiziksel konum ve Z yüksekliğini CSS'e çevirir.
// İçindeki grafik bileşen (PlayerGraphic, BoxGraphic) bunu bilmez.
//
// SORUMLULUK: position → translate, z → scale+yOffset, animasyon geçişi.
// KURAL: Oyun mantığı yok. Sadece veriyi CSS'e çevirir.

import { ReactNode, useEffect, useRef, useState } from 'react';
import { Entity } from '../logic/entityTypes';
import { CellTypes } from '../logic/cellTypes';
import { Direction } from '../logic/types';

const CELL_SIZE = 64;

interface PhysicsWrapperProps {
    entity: Entity;
    prevEntity: Entity | null;
    currentCellType: CellTypes;
    frameMs: number;
    children: ReactNode;
}

export const PhysicsWrapper = ({ entity, prevEntity, currentCellType, frameMs, children }: PhysicsWrapperProps) => {
    const { z, force, direction } = entity.physics;
    const { row, col } = entity.position;

    const x = col * CELL_SIZE;
    const y = row * CELL_SIZE;

    // 1. Işınlanma (Teleport) Tespiti (Render-time, pure!)
    const prevRow = prevEntity ? prevEntity.position.row : row;
    const prevCol = prevEntity ? prevEntity.position.col : col;
    const rowDiff = Math.abs(row - prevRow);
    const colDiff = Math.abs(col - prevCol);
    const isTeleporting = rowDiff > 1 || colDiff > 1;

    // 2. Yere İniş Anında Ezilme (Landing Squash) Tespiti
    const prevZRef = useRef(z);
    const [isLanded, setIsLanded] = useState(false);

    useEffect(() => {
        if (prevZRef.current > 0 && z === 0) {
            setIsLanded(true);
            const timer = setTimeout(() => setIsLanded(false), 220);
            return () => clearTimeout(timer);
        }
        prevZRef.current = z;
    }, [z]);

    // Z değerine göre dikey esneme ve zOffset yüksekliği (Trampolin/Düşüş)
    const zOffset = -(z * 14); // Zıplama yüksekliği Y ekseninde yukarı kaydırma

    // Havada zıplarken dikeyde esneme (Stretch)
    const stretchX = z > 0 ? 1 - z * 0.06 : 1;
    const stretchY = z > 0 ? 1 + z * 0.12 : 1;

    // Zıplama yükselmesi ve genel scale
    const baseScale = 1 + z * 0.15;

    // Buz üzerinde ve hareket ediyorsa kayma tilt efekti ve parçacıklar
    const isSliding = force > 0 && currentCellType === 'ice';

    // Kayma yönüne göre eğilme açısı (Skew)
    let skew = '';
    if (isSliding) {
        if (direction === 'left') skew = 'skewX(12deg)';
        if (direction === 'right') skew = 'skewX(-12deg)';
        if (direction === 'up') skew = 'skewY(-6deg)';
        if (direction === 'down') skew = 'skewY(6deg)';
    }

    // Parçacıkların kayma yönünün tersine akması için yön CSS sınıfı
    const particleClass = isSliding ? `ice-trail-${direction}` : '';

    // Özel animasyonların (çarpışma, engellenme, ölüm, zafer) tespiti
    const bumpDirection = entity.customData.bumpDirection as Direction | undefined;
    const bumpReason = entity.customData.bumpReason as string | undefined;
    const deathReason = entity.customData.deathReason as string | undefined;
    const isVictory = entity.customData.isVictory as boolean | undefined;

    let customAnimation = undefined;
    if (deathReason) {
        if (deathReason === 'forbidden') {
            customAnimation = 'death-forbidden 800ms ease-in-out forwards';
        } else if (deathReason === 'crushed') {
            customAnimation = 'death-crushed 800ms cubic-bezier(0.25, 1, 0.2, 1) forwards';
        } else if (deathReason === 'lava_edge') {
            customAnimation = 'death-lava 800ms ease-in forwards';
        } else if (deathReason === 'trail') {
            customAnimation = 'death-trail 800ms ease-in-out forwards';
        }
    } else if (isVictory) {
        customAnimation = 'victory-spin 800ms ease-in-out infinite';
    } else if (bumpDirection) {
        const duration = `${frameMs}ms`;
        if (bumpReason === 'collision') {
            customAnimation = `collision-shake ${duration} ease-in-out`;
        } else if (bumpReason === 'blocked_push') {
            customAnimation = `blocked-push-${bumpDirection} ${duration} cubic-bezier(0.25, 1, 0.5, 1)`;
        } else if (bumpReason === 'conveyor') {
            customAnimation = `conveyor-reject-${bumpDirection} ${duration} ease-in-out`;
        } else {
            customAnimation = `bump-${bumpDirection} ${duration} cubic-bezier(0.25, 1.1, 0.5, 1.1)`;
        }
    } else if (isTeleporting) {
        customAnimation = `teleportInEffect ${frameMs}ms ease-out forwards`;
    } else if (isLanded) {
        customAnimation = 'landingSquashEffect 220ms ease-in-out';
    }

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: CELL_SIZE,
                height: CELL_SIZE,
                transform: `translate(${x}px, ${y + zOffset}px)`,
                transition: isTeleporting ? 'none' : `transform ${frameMs}ms cubic-bezier(0.25, 1.1, 0.5, 1.1)`,
                zIndex: 10 + z,
            }}
        >
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    transform: `scale(${baseScale * stretchX}, ${baseScale * stretchY}) ${skew}`,
                    filter: isSliding ? 'brightness(1.15) contrast(1.05)' : undefined,
                    animation: customAnimation,
                }}
            >
                {/* Dinamik Animasyon Keyframes ve Buz Parçacık Trail Stilleri */}
                <style>{`
                    @keyframes teleportInEffect {
                        0% { transform: scale(0) rotate(120deg); opacity: 0; filter: brightness(3) hue-rotate(90deg); }
                        50% { transform: scale(1.3); opacity: 0.8; filter: brightness(2); }
                        100% { transform: scale(1) rotate(0deg); opacity: 1; filter: brightness(1); }
                    }
                    @keyframes landingSquashEffect {
                        0% { transform: scale(1.3, 0.7); }
                        40% { transform: scale(0.85, 1.15); }
                        70% { transform: scale(1.05, 0.95); }
                        100% { transform: scale(1, 1); }
                    }
                    @keyframes iceDustLeft {
                        0% { transform: translate(16px, 48px) scale(1); opacity: 0.8; }
                        100% { transform: translate(56px, 40px) scale(0.1); opacity: 0; }
                    }
                    @keyframes iceDustRight {
                        0% { transform: translate(48px, 48px) scale(1); opacity: 0.8; }
                        100% { transform: translate(8px, 40px) scale(0.1); opacity: 0; }
                    }
                    @keyframes iceDustUp {
                        0% { transform: translate(32px, 48px) scale(1); opacity: 0.8; }
                        100% { transform: translate(32px, 80px) scale(0.1); opacity: 0; }
                    }
                    @keyframes iceDustDown {
                        0% { transform: translate(32px, 16px) scale(1); opacity: 0.8; }
                        100% { transform: translate(32px, -16px) scale(0.1); opacity: 0; }
                    }
                    .ice-dust-particle {
                        position: absolute;
                        width: 6px;
                        height: 6px;
                        border-radius: 50%;
                        background: rgba(165,243,252,0.85);
                        box-shadow: 0 0 5px rgba(165,243,252,1);
                        pointer-events: none;
                    }
                    .ice-trail-left { animation: iceDustLeft 220ms infinite linear; }
                    .ice-trail-right { animation: iceDustRight 220ms infinite linear; }
                    .ice-trail-up { animation: iceDustUp 220ms infinite linear; }
                    .ice-trail-down { animation: iceDustDown 220ms infinite linear; }
                `}</style>

                {/* Buzda Kayma Parçacıkları (Trail) */}
                {isSliding && (
                    <div style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
                        <div className={`ice-dust-particle ${particleClass}`} style={{ animationDelay: '0ms' }} />
                        <div className={`ice-dust-particle ${particleClass}`} style={{ animationDelay: '70ms', left: 4, top: 4 }} />
                        <div className={`ice-dust-particle ${particleClass}`} style={{ animationDelay: '140ms', left: -4, top: 2 }} />
                    </div>
                )}

                {children}
            </div>
        </div>
    );
};
