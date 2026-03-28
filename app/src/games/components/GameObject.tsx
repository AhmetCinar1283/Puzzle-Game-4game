import { motion } from 'framer-motion';
import type { GameObjectState } from '../types';

interface GameObjectProps {
  object: GameObjectState;
  cellSize: number;
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

export default function GameObject({ object, cellSize }: GameObjectProps) {
  const neon = OBJECT_NEON[object.id] ?? {
    bg: '#bf5fff',
    glow: '0 0 12px #bf5fff, 0 0 24px rgba(191,95,255,0.5)',
    textColor: '#1a0033',
  };
  const x = object.position.col * cellSize;
  const y = object.position.row * cellSize;
  const padding = Math.floor(cellSize * 0.12);
  const size = cellSize - padding * 2;

  return (
    <motion.div
      animate={{ x, y }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        position: 'absolute',
        top: padding,
        left: padding,
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: neon.bg,
        boxShadow: neon.glow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
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
    </motion.div>
  );
}
