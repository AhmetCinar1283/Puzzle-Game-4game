'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { animate as fmAnimate } from 'framer-motion';
import type { AnimationPlaybackControls } from 'framer-motion';
import type { BoxState, Waypoint } from '../types';

interface GameBoxObjectProps {
  box: BoxState;
  cellSize: number;
  isPowered: boolean;
  /** Ordered waypoints from animationPaths["box:id"].
   *  Each waypoint carries z > 0 when box is airborne (e.g. trampoline). */
  path?: Waypoint[];
}

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 30 };
const STEP_S = 0.08;
const Z_SCALE = 0.08; // same multiplier as GameObject

export default function GameBoxObject({ box, cellSize, isPowered, path }: GameBoxObjectProps) {
  const pad = Math.round(cellSize * 0.1);
  const size = cellSize - pad * 2;

  const mvX = useMotionValue(box.position.col * cellSize + pad);
  const mvY = useMotionValue(box.position.row * cellSize + pad);
  const mvScale = useMotionValue(1);

  const prevPathKeyRef = useRef('');
  const activeControls = useRef<AnimationPlaybackControls[]>([]);

  useEffect(() => {
    for (const ctrl of activeControls.current) ctrl.stop?.();
    activeControls.current = [];

    const finalX = box.position.col * cellSize + pad;
    const finalY = box.position.row * cellSize + pad;

    if (!path || path.length === 0) {
      prevPathKeyRef.current = '';
      mvX.set(finalX);
      mvY.set(finalY);
      mvScale.set(1);
      return;
    }

    const newKey = path.map((p) => `${p.row},${p.col},${p.z}`).join('|');
    if (newKey === prevPathKeyRef.current) return;
    prevPathKeyRef.current = newKey;

    if (path.length > 2) {
      mvX.set(path[0].col * cellSize + pad);
      mvY.set(path[0].row * cellSize + pad);
      mvScale.set(1 + (path[0].z ?? 0) * Z_SCALE);

      let delay = 0;
      const controls: AnimationPlaybackControls[] = [];
      for (let i = 1; i < path.length; i++) {
        const wp = path[i];
        controls.push(fmAnimate(mvX, wp.col * cellSize + pad, { duration: STEP_S, delay, ease: 'linear' }));
        controls.push(fmAnimate(mvY, wp.row * cellSize + pad, { duration: STEP_S, delay, ease: 'linear' }));
        controls.push(fmAnimate(mvScale, 1 + (wp.z ?? 0) * Z_SCALE, { duration: STEP_S, delay, ease: 'linear' }));
        delay += STEP_S;
      }
      activeControls.current = controls;
      return;
    }

    const finalScale = 1 + (path[path.length - 1]?.z ?? 0) * Z_SCALE;
    activeControls.current = [
      fmAnimate(mvX, finalX, SPRING),
      fmAnimate(mvY, finalY, SPRING),
      fmAnimate(mvScale, finalScale, SPRING),
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, cellSize, pad]);

  const isUnpowered = box.requiresPower && !isPowered;

  return (
    <motion.div
      style={{
        x: mvX,
        y: mvY,
        scale: mvScale,
        position: 'absolute',
        top: 0,
        left: 0,
        width: size,
        height: size,
        borderRadius: 6,
        background: isUnpowered ? 'rgba(30, 40, 55, 0.9)' : 'rgba(15, 23, 35, 0.95)',
        border: isUnpowered ? '2px solid rgba(71, 85, 105, 0.5)' : '2px solid #f97316',
        boxShadow: isUnpowered
          ? 'inset 0 1px 0 rgba(71,85,105,0.15)'
          : '0 0 10px rgba(249,115,22,0.5), 0 0 20px rgba(249,115,22,0.2), inset 0 1px 0 rgba(249,115,22,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          fontSize: size * 0.28,
          lineHeight: 1,
          color: isUnpowered ? '#334155' : '#f97316',
          textShadow: isUnpowered ? 'none' : '0 0 8px rgba(249,115,22,0.8)',
          fontWeight: 'bold',
          userSelect: 'none',
        }}
      >
        ▣
      </span>
      {box.requiresPower && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 3,
            fontSize: size * 0.2,
            lineHeight: 1,
            color: isPowered ? '#fbbf24' : '#334155',
            textShadow: isPowered ? '0 0 6px rgba(251,191,36,0.8)' : 'none',
            userSelect: 'none',
          }}
        >
          ⚡
        </span>
      )}
    </motion.div>
  );
}
