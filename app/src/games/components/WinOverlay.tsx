import { motion, AnimatePresence } from 'framer-motion';

interface WinOverlayProps {
  moveCount: number;
  onRestart: () => void;
  onNextLevel?: () => void;
}

export default function WinOverlay({ moveCount, onRestart, onNextLevel }: WinOverlayProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(2, 5, 14, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 20,
          borderRadius: 4,
        }}
      >
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.7, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          style={{
            background: 'rgba(3, 7, 18, 0.97)',
            border: '1px solid rgba(0, 255, 136, 0.4)',
            boxShadow: '0 0 40px rgba(0, 255, 136, 0.15), 0 0 80px rgba(0, 255, 136, 0.05)',
            borderRadius: 16,
            padding: '36px 48px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div style={{ fontSize: 40 }}>✦</div>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: '#00ff88',
              textShadow: '0 0 16px rgba(0,255,136,0.6)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Level Complete
          </h2>
          <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>
            Solved in{' '}
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>{moveCount}</span> moves
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              onClick={onRestart}
              style={{
                fontSize: 12,
                padding: '8px 20px',
                background: 'rgba(148, 163, 184, 0.06)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                color: '#94a3b8',
                borderRadius: 8,
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              RESTART
            </button>
            {onNextLevel && (
              <button
                onClick={onNextLevel}
                style={{
                  fontSize: 12,
                  padding: '8px 20px',
                  background: 'rgba(0, 255, 136, 0.08)',
                  border: '1px solid rgba(0, 255, 136, 0.45)',
                  color: '#00ff88',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  boxShadow: '0 0 12px rgba(0,255,136,0.15)',
                }}
              >
                NEXT LEVEL →
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
