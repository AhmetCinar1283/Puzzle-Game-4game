import { motion } from 'framer-motion';
import type { GameObjectState } from '../types';

interface GameObjectProps {
  object: GameObjectState;
  cellSize: number;
}

const OBJECT_COLORS: Record<number, { bg: string; ring: string }> = {
  1: { bg: '#10b981', ring: '#059669' },
  2: { bg: '#0ea5e9', ring: '#0284c7' },
};

export default function GameObject({ object, cellSize }: GameObjectProps) {
  const color = OBJECT_COLORS[object.id] ?? { bg: '#8b5cf6', ring: '#7c3aed' };
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
        backgroundColor: color.bg,
        boxShadow: `0 0 0 3px ${color.ring}`,
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
        <span style={{ fontSize: size * 0.35, lineHeight: 1, opacity: 0.9 }}>
          {object.mode === 'reversed' ? '↺' : '↻'}
        </span>
      )}
    </motion.div>
  );
}
