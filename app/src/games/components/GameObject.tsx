'use client';

import { useEffect } from 'react';
import { motion, useAnimate } from 'framer-motion';
import type { GameObjectState, MoveAnimType } from '../types';

interface GameObjectProps {
  object: GameObjectState;
  cellSize: number;
  animType?: MoveAnimType;
}

const OBJECT_NEON: Record<number, { bg: string; glow: string; textColor: string }> = {
  1: {
    bg: '#00ff88',
    glow: '0 0 12px #00ff88, 0 0 24px rgba(0,255,136,0.5), 0 0 40px rgba(0,255,136,0.2)',
    textColor: '#003320',
  },
  2: {
    bg: '#00c4ff',
    glow: '0 0 12px #00c4ff, 0 0 24px rgba(0,196,255,0.5), 0 0 40px rgba(0,196,255,0.2)',
    textColor: '#002233',
  },
};

export default function GameObject({ object, cellSize, animType = 'normal' }: GameObjectProps) {
  const neon = OBJECT_NEON[object.id] ?? {
    bg: '#bf5fff',
    glow: '0 0 12px #bf5fff, 0 0 24px rgba(191,95,255,0.5)',
    textColor: '#1a0033',
  };
  const x = object.position.col * cellSize;
  const y = object.position.row * cellSize;
  const padding = Math.floor(cellSize * 0.12);
  const size = cellSize - padding * 2;

  // scope → iç div'e ref; animate → WAAPI ile bağımsız animasyon (x/y ile çakışmaz)
  const [scope, animate] = useAnimate();

  // Pozisyon hareketi için spring (animType'a göre)
  const positionTransition =
    animType === 'portal' || animType === 'teleport'
      ? { duration: 0 }                                            // Anında zıpla
      : animType === 'ice'
      ? { type: 'spring' as const, stiffness: 150, damping: 16 }  // Yavaş, kaygan
      : animType === 'conveyor'
      ? { type: 'spring' as const, stiffness: 320, damping: 12 }  // Biraz sektir
      : { type: 'spring' as const, stiffness: 400, damping: 30 }; // Normal

  // İkincil animasyonlar: materialize burst (portal/teleport) veya dönme (ice)
  useEffect(() => {
    if (!scope.current) return;
    if (animType === 'portal' || animType === 'teleport') {
      // Yeni pozisyona anında geldi → "materialize" efekti
      animate(scope.current, { scale: [0.2, 1.35, 1], opacity: [0, 1, 1] }, { duration: 0.35, ease: 'easeOut' });
    } else if (animType === 'ice') {
      // Buzda kayarken dönsün
      animate(scope.current, { rotate: [0, 28, -20, 10, 0] }, { duration: 0.8, ease: 'easeInOut' });
    }
  }, [object.position.row, object.position.col, animType]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // Dış motion.div: sadece x/y pozisyon hareketi
    <motion.div
      animate={{ x, y }}
      transition={positionTransition}
      style={{
        position: 'absolute',
        top: padding,
        left: padding,
        width: size,
        height: size,
        zIndex: 10,
      }}
    >
      {/* İç div: scale/rotate/opacity (WAAPI, dış x/y transform'una karışmaz) */}
      <div
        ref={scope}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor: neon.bg,
          boxShadow: neon.glow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        {object.isLocked ? (
          <span style={{ fontSize: size * 0.35, lineHeight: 1 }}>🔒</span>
        ) : (
          <span
            style={{
              fontSize: size * 0.38,
              lineHeight: 1,
              color: neon.textColor,
              fontWeight: 'bold',
            }}
          >
            {object.mode === 'reversed' ? '↺' : '↻'}
          </span>
        )}
      </div>
    </motion.div>
  );
}
