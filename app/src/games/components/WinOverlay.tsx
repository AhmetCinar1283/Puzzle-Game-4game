'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@/app/src/contexts/LanguageContext';

interface WorkerResult {
  stars: 1 | 2 | 3;
  scoreDelta: number;
  isFirstCompletion: boolean;
  isNewBestSolution: boolean;
  isBestSolution: boolean;
  isGoodSolution: boolean;
}

interface WinOverlayProps {
  moveCount: number;
  onRestart: () => void;
  onNextLevel?: () => void;
  workerResult?: WorkerResult | null;
}

// Her yıldız kendi AnimatePresence'ına sahip:
// Loading → gri, soluk · Result → sırayla neon parlama
function Star({ n, loading, workerResult }: { n: 1 | 2 | 3; loading: boolean; workerResult: WorkerResult | null }) {
  const isLit = !loading && workerResult !== null && n <= workerResult.stars;

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.span
          key="grey"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.25 }}
          exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.15 } }}
          transition={{ delay: (n - 1) * 0.07, duration: 0.25, type: 'spring', stiffness: 300, damping: 20 }}
          style={{ fontSize: 40, color: '#1e3a5f', display: 'inline-block', lineHeight: 1 }}
        >
          ★
        </motion.span>
      ) : (
        <motion.span
          key={isLit ? 'gold' : 'dim'}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={isLit
            ? {
                scale:  [0.3, 2.1, 0.9, 1.05, 1],
                opacity: 1,
                color:  ['#1e3a5f', '#ffe066', '#ffd700', '#ffd700'],
                filter: [
                  'drop-shadow(0 0 0px #ffd700)',
                  'drop-shadow(0 0 32px #ffd700) drop-shadow(0 0 64px #ff9900)',
                  'drop-shadow(0 0 14px #ffd700) drop-shadow(0 0 28px rgba(255,160,0,0.6))',
                  'drop-shadow(0 0 10px #ffd700) drop-shadow(0 0 22px rgba(255,160,0,0.45))',
                ],
              }
            : {
                scale: 0.85,
                opacity: 0.18,
                color: '#1e3a5f',
                filter: 'drop-shadow(0 0 0px transparent)',
              }
          }
          exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.12 } }}
          transition={isLit
            ? { delay: (n - 1) * 0.22, duration: 0.7, ease: [0.22, 1, 0.36, 1] }
            : { delay: (n - 1) * 0.05, duration: 0.2 }
          }
          style={{ fontSize: 40, display: 'inline-block', lineHeight: 1 }}
        >
          ★
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export default function WinOverlay({ moveCount, onRestart, onNextLevel, workerResult }: WinOverlayProps) {
  const t = useT();
  const loading = workerResult == null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(2, 5, 14, 0.78)',
          backdropFilter: 'blur(5px)',
          zIndex: 20,
          borderRadius: 4,
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 28 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 28 }}
          transition={{ type: 'spring', stiffness: 340, damping: 26, delay: 0.04 }}
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
            minWidth: 240,
          }}
        >
          {/* ✦ — loading'de nefes alır */}
          <motion.div
            animate={loading
              ? { opacity: [0.35, 1, 0.35], scale: [0.9, 1.1, 0.9] }
              : { opacity: 1, scale: 1 }
            }
            transition={loading
              ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' }
              : { duration: 0.3 }
            }
            style={{ fontSize: 40 }}
          >
            ✦
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
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
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.26 }}
            style={{ color: '#475569', fontSize: 13, margin: 0 }}
          >
            {t('win.solved_in', { n: moveCount })}
          </motion.p>

          {/* Yıldızlar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Star n={1} loading={loading} workerResult={workerResult ?? null} />
              <Star n={2} loading={loading} workerResult={workerResult ?? null} />
              <Star n={3} loading={loading} workerResult={workerResult ?? null} />
            </div>

            {/* Loading noktaları */}
            <AnimatePresence>
              {loading && (
                <motion.div
                  key="dots"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.18 }}
                  style={{ display: 'flex', gap: 5, alignItems: 'center', height: 14 }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ y: [0, -5, 0], opacity: [0.25, 1, 0.25] }}
                      transition={{ repeat: Infinity, duration: 0.85, delay: i * 0.17, ease: 'easeInOut' }}
                      style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#1e3a5f' }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* +N PTS */}
            <AnimatePresence>
              {!loading && workerResult!.scoreDelta > 0 && (
                <motion.p
                  key="pts"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 14, delay: 0.65 + 2 * 0.22 }}
                  style={{
                    color: '#ffd700',
                    textShadow: '0 0 10px rgba(255,215,0,0.6)',
                    fontSize: 13,
                    fontWeight: 700,
                    margin: 0,
                    letterSpacing: '0.08em',
                  }}
                >
                  +{workerResult!.scoreDelta} PTS
                </motion.p>
              )}
            </AnimatePresence>

            {/* New Best / Best / Good */}
            <AnimatePresence>
              {!loading && (workerResult!.isNewBestSolution || workerResult!.isBestSolution || workerResult!.isGoodSolution) && (
                <motion.p
                  key="best-badge"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.82, duration: 0.3 }}
                  style={{
                    color: workerResult!.isNewBestSolution ? '#00ff88'
                      : workerResult!.isBestSolution ? '#00c4ff'
                      : '#9333ea',
                    textShadow: workerResult!.isNewBestSolution
                      ? '0 0 8px rgba(0,255,136,0.6)'
                      : workerResult!.isBestSolution
                        ? '0 0 8px rgba(0,196,255,0.6)'
                        : '0 0 8px rgba(147,51,234,0.6)',
                    fontSize: 10,
                    margin: 0,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  {workerResult!.isNewBestSolution ? 'New Best'
                    : workerResult!.isBestSolution ? 'Best'
                    : 'Good'}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Butonlar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34 }}
            style={{ display: 'flex', gap: 12, marginTop: 8 }}
          >
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
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
