'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@/app/src/contexts/LanguageContext';

interface WorkerResult {
  stars: 1 | 2 | 3;
  scoreDelta: number;
  isFirstCompletion: boolean;
  isNewBestSolution: boolean;
}

interface WinOverlayProps {
  moveCount: number;
  onRestart: () => void;
  onNextLevel?: () => void;
  workerResult?: WorkerResult | null;
}

export default function WinOverlay({ moveCount, onRestart, onNextLevel, workerResult }: WinOverlayProps) {
  const t = useT();
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
            {t('win.title')}
          </h2>
          <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>
            {t('win.solved_in', { n: moveCount })}
          </p>

          {/* Stars — grey while worker is responding, gold once data arrives */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 32, letterSpacing: 6 }}>
              {workerResult != null
                ? [1, 2, 3].map((n) => (
                    <span
                      key={n}
                      style={{
                        color: n <= workerResult.stars ? '#ffd700' : '#1e3a5f',
                        textShadow: n <= workerResult.stars ? '0 0 8px rgba(255,215,0,0.5)' : 'none',
                      }}
                    >★</span>
                  ))
                : [1, 2, 3].map((n) => (
                    <span key={n} style={{ color: '#1e3a5f' }}>★</span>
                  ))
              }
            </div>
            {workerResult?.scoreDelta != null && workerResult.scoreDelta > 0 && (
              <p style={{ color: '#ffd700', fontSize: 11, margin: 0, letterSpacing: '0.06em' }}>
                +{workerResult.scoreDelta} PTS
              </p>
            )}
            {workerResult?.isNewBestSolution && (
              <p style={{ color: '#00c4ff', fontSize: 10, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                New Best
              </p>
            )}
          </div>

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
              {t('win.restart')}
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
                {t('win.next_level')}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
