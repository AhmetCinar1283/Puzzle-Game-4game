'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useAnimate } from 'framer-motion';
import { animate as fmAnimate } from 'framer-motion';
import type { AnimationPlaybackControls } from 'framer-motion';
import type { GameObjectState, MoveAnimType, Waypoint } from '../types';

interface GameObjectProps {
  object: GameObjectState;
  cellSize: number;
  animType?: MoveAnimType;
  /** Ordered waypoints from animationPaths["player:id"].
   *  Each waypoint carries z: > 0 means entity is airborne (scale up for visual arc). */
  path?: Waypoint[];
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

// Step duration per grid cell for multi-waypoint paths
const STEP_S = 0.08;

// Scale multiplier per unit of z — entity grows slightly while airborne
const Z_SCALE = 0.08;

export default function GameObject({ object, cellSize, animType = 'normal', path }: GameObjectProps) {
  const neon = OBJECT_NEON[object.id] ?? {
    bg: '#bf5fff',
    glow: '0 0 12px #bf5fff, 0 0 24px rgba(191,95,255,0.5)',
    textColor: '#1a0033',
  };
  const padding = Math.floor(cellSize * 0.12);
  const size = cellSize - padding * 2;

  // Motion values — driven exclusively via effects
  const mvX = useMotionValue(object.position.col * cellSize);
  const mvY = useMotionValue(object.position.row * cellSize);
  // Scale driven by z — 1.0 at ground, grows with height
  const mvScale = useMotionValue(1);

  // Inner div scope for secondary effects (rotate, opacity)
  const [scope, animateScope] = useAnimate();

  const prevPathKeyRef = useRef('');
  const activeControls = useRef<AnimationPlaybackControls[]>([]);

  useEffect(() => {
    // Cancel any in-flight animations first
    for (const ctrl of activeControls.current) ctrl.stop?.();
    activeControls.current = [];

    const finalX = object.position.col * cellSize;
    const finalY = object.position.row * cellSize;

    // No path → restart / load level → jump immediately to position
    if (!path || path.length === 0) {
      prevPathKeyRef.current = '';
      mvX.set(finalX);
      mvY.set(finalY);
      mvScale.set(1);
      return;
    }

    // Include z in key so same grid path with different arc still re-animates
    const newKey = path.map((p) => `${p.row},${p.col},${p.z}`).join('|');
    if (newKey === prevPathKeyRef.current) return;
    prevPathKeyRef.current = newKey;

    // ── Teleport / portal: instant jump + materialize burst ───────────────────
    if (animType === 'teleport' || animType === 'portal') {
      mvX.set(finalX);
      mvY.set(finalY);
      mvScale.set(1);
      if (scope.current) {
        animateScope(
          scope.current,
          { scale: [0.2, 1.35, 1], opacity: [0, 1, 1] },
          { duration: 0.35, ease: 'easeOut' },
        );
      }
      return;
    }

    // ── Multi-step path: walk through every waypoint ───────────────────────────
    if (path.length > 2) {
      mvX.set(path[0].col * cellSize);
      mvY.set(path[0].row * cellSize);
      mvScale.set(1 + (path[0].z ?? 0) * Z_SCALE);

      let delay = 0;
      const controls: AnimationPlaybackControls[] = [];

      for (let i = 1; i < path.length; i++) {
        const wp = path[i];
        const targetScale = 1 + (wp.z ?? 0) * Z_SCALE;
        controls.push(
          fmAnimate(mvX, wp.col * cellSize, { duration: STEP_S, delay, ease: 'linear' }),
        );
        controls.push(
          fmAnimate(mvY, wp.row * cellSize, { duration: STEP_S, delay, ease: 'linear' }),
        );
        controls.push(
          fmAnimate(mvScale, targetScale, { duration: STEP_S, delay, ease: 'linear' }),
        );
        delay += STEP_S;
      }
      activeControls.current = controls;

      // Ice rotation effect spans the full slide duration
      if (animType === 'ice' && scope.current) {
        animateScope(
          scope.current,
          { rotate: [0, 28, -20, 10, 0] },
          { duration: delay, ease: 'easeInOut' },
        );
      }
      return;
    }

    // ── Single step: spring to final position ─────────────────────────────────
    const finalScale = 1 + (path[path.length - 1]?.z ?? 0) * Z_SCALE;
    const spring =
      animType === 'conveyor'
        ? { type: 'spring' as const, stiffness: 320, damping: 12 }
        : { type: 'spring' as const, stiffness: 400, damping: 30 };

    activeControls.current = [
      fmAnimate(mvX, finalX, spring),
      fmAnimate(mvY, finalY, spring),
      fmAnimate(mvScale, finalScale, spring),
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, animType, cellSize]);

  return (
    // Outer motion.div: x/y position + scale (z arc)
    <motion.div
      style={{
        x: mvX,
        y: mvY,
        scale: mvScale,
        position: 'absolute',
        top: padding,
        left: padding,
        width: size,
        height: size,
        zIndex: 10,
      }}
    >
      {/* Inner div: rotate / opacity (WAAPI, doesn't conflict with x/y/scale) */}
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
            {object.mode === 'reversed' ? '⬇' : '⬆'}
          </span>
        )}
      </div>
    </motion.div>
  );
}
