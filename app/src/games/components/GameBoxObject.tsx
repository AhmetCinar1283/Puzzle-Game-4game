'use client';

import { motion } from 'framer-motion';
import type { BoxState } from '../types';

interface GameBoxObjectProps {
  box: BoxState;
  cellSize: number;
  isPowered: boolean;
}

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 30 };

export default function GameBoxObject({ box, cellSize, isPowered }: GameBoxObjectProps) {
  const pad = Math.round(cellSize * 0.1);
  const size = cellSize - pad * 2;

  const x = box.position.col * cellSize + pad;
  const y = box.position.row * cellSize + pad;

  const isUnpowered = box.requiresPower && !isPowered;

  return (
    <motion.div
      animate={{ x, y }}
      transition={SPRING}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: size,
        height: size,
        borderRadius: 6,
        background: isUnpowered
          ? 'rgba(30, 40, 55, 0.9)'
          : 'rgba(15, 23, 35, 0.95)',
        border: isUnpowered
          ? '2px solid rgba(71, 85, 105, 0.5)'
          : '2px solid #f97316',
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
