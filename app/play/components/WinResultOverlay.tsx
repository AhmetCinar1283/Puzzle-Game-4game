'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@/app/src/contexts/LanguageContext';

interface WorkerResult {
    success: boolean;
    stars?: 1 | 2 | 3;
    scoreDelta?: number;
    isFirstCompletion?: boolean;
    isNewBestSolution?: boolean;
    isBestSolution?: boolean;
    isGoodSolution?: boolean;
}

interface WinResultOverlayProps {
    result: WorkerResult | null; // null = yükleniyor
    moveCount: number;
    onRestart: () => void;
    onNextLevel: (() => void) | undefined;
    onMenu: () => void;
}

function Star({ n, loading, stars }: { n: 1 | 2 | 3; loading: boolean; stars: number }) {
    const isLit = !loading && n <= stars;

    return (
        <AnimatePresence mode="wait">
            {loading ? (
                <motion.span
                    key="grey"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 0.25 }}
                    exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ delay: (n - 1) * 0.07, duration: 0.25, type: 'spring', stiffness: 300, damping: 20 }}
                    style={{ fontSize: 'clamp(28px, 8vw, 40px)', color: '#1e3a5f', display: 'inline-block', lineHeight: 1 }}
                >
                    ★
                </motion.span>
            ) : (
                <motion.span
                    key={isLit ? 'gold' : 'dim'}
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={isLit
                        ? {
                            scale: [0.3, 2.1, 0.9, 1.05, 1],
                            opacity: 1,
                            color: ['#1e3a5f', '#ffe066', '#ffd700', '#ffd700'],
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
                    style={{ fontSize: 'clamp(28px, 8vw, 40px)', display: 'inline-block', lineHeight: 1 }}
                >
                    ★
                </motion.span>
            )}
        </AnimatePresence>
    );
}

export function WinResultOverlay({ result, moveCount, onRestart, onNextLevel, onMenu }: WinResultOverlayProps) {
    const t = useT();
    const loading = result === null;
    const stars = result?.stars ?? 0;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                style={{
                    position: 'fixed',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(2, 5, 14, 0.82)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    zIndex: 200,
                    // Güvenli alan (notch, home indicator)
                    padding: 'env(safe-area-inset-top, 16px) env(safe-area-inset-right, 16px) env(safe-area-inset-bottom, 16px) env(safe-area-inset-left, 16px)',
                    boxSizing: 'border-box',
                }}
            >
                <motion.div
                    initial={{ scale: 0.85, opacity: 0, y: 24 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.85, opacity: 0, y: 24 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 26, delay: 0.04 }}
                    style={{
                        background: 'rgba(3, 7, 18, 0.97)',
                        border: '1px solid rgba(0, 255, 136, 0.4)',
                        boxShadow: '0 0 40px rgba(0, 255, 136, 0.15), 0 0 80px rgba(0, 255, 136, 0.05)',
                        borderRadius: 20,
                        // Responsive padding: compact on small screens
                        padding: 'clamp(20px, 5vw, 40px) clamp(24px, 6vw, 52px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 'clamp(10px, 3vw, 16px)',
                        // Genişlik: ekranın %88'i ama max 340px
                        width: 'min(88vw, 340px)',
                        boxSizing: 'border-box',
                    }}
                >
                    {/* Pulsing glow crown */}
                    <motion.div
                        animate={loading
                            ? { opacity: [0.35, 1, 0.35], scale: [0.9, 1.1, 0.9] }
                            : { opacity: 1, scale: 1 }
                        }
                        transition={loading
                            ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' }
                            : { duration: 0.3 }
                        }
                        style={{ fontSize: 'clamp(28px, 8vw, 40px)', lineHeight: 1 }}
                    >
                        ✦
                    </motion.div>

                    {/* Level Completed Title */}
                    <motion.h2
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.16 }}
                        style={{
                            fontSize: 'clamp(16px, 5vw, 22px)',
                            fontWeight: 800,
                            color: '#00ff88',
                            textShadow: '0 0 16px rgba(0,255,136,0.6)',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            margin: 0,
                            textAlign: 'center',
                        }}
                    >
                        {t('win.title')}
                    </motion.h2>

                    {/* Solved in Moves */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.26 }}
                        style={{ color: '#475569', fontSize: 'clamp(11px, 3vw, 13px)', margin: 0, textAlign: 'center' }}
                    >
                        {t('win.solved_in', { n: moveCount })}
                    </motion.p>

                    {/* Stars Container */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 'clamp(4px, 2vw, 10px)' }}>
                            <Star n={1} loading={loading} stars={stars} />
                            <Star n={2} loading={loading} stars={stars} />
                            <Star n={3} loading={loading} stars={stars} />
                        </div>

                        {/* Loading dots */}
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

                        {/* Point Change (+PTS) */}
                        <AnimatePresence>
                            {!loading && result && result.scoreDelta !== undefined && result.scoreDelta > 0 && (
                                <motion.p
                                    key="pts"
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 450, damping: 14, delay: 0.65 + 2 * 0.22 }}
                                    style={{
                                        color: '#ffd700',
                                        textShadow: '0 0 10px rgba(255,215,0,0.6)',
                                        fontSize: 'clamp(11px, 3vw, 13px)',
                                        fontWeight: 700,
                                        margin: 0,
                                        letterSpacing: '0.08em',
                                    }}
                                >
                                    +{result.scoreDelta} PTS
                                </motion.p>
                            )}
                        </AnimatePresence>

                        {/* Badge */}
                        <AnimatePresence>
                            {!loading && result && (result.isNewBestSolution || result.isBestSolution || result.isGoodSolution) && (
                                <motion.p
                                    key="best-badge"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ delay: 0.82, duration: 0.3 }}
                                    style={{
                                        color: result.isNewBestSolution ? '#00ff88'
                                            : result.isBestSolution ? '#00c4ff'
                                            : '#9333ea',
                                        textShadow: result.isNewBestSolution
                                            ? '0 0 8px rgba(0,255,136,0.6)'
                                            : result.isBestSolution
                                                ? '0 0 8px rgba(0,196,255,0.6)'
                                                : '0 0 8px rgba(147,51,234,0.6)',
                                        fontSize: 'clamp(9px, 2.5vw, 11px)',
                                        margin: 0,
                                        letterSpacing: '0.1em',
                                        textTransform: 'uppercase',
                                        fontWeight: 700,
                                    }}
                                >
                                    {result.isNewBestSolution ? 'Yeni Rekor'
                                        : result.isBestSolution ? 'Rekor'
                                        : 'İyi Çözüm'}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Action buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.34 }}
                        style={{
                            display: 'flex',
                            gap: 10,
                            marginTop: 4,
                            width: '100%',
                            justifyContent: 'center',
                            flexWrap: 'wrap',
                        }}
                    >
                        <button
                            onClick={onRestart}
                            style={{
                                fontSize: 'clamp(11px, 3vw, 13px)',
                                padding: 'clamp(8px, 2vw, 10px) clamp(16px, 4vw, 22px)',
                                background: 'rgba(148, 163, 184, 0.06)',
                                border: '1px solid rgba(148, 163, 184, 0.25)',
                                color: '#94a3b8',
                                borderRadius: 10,
                                cursor: 'pointer',
                                letterSpacing: '0.04em',
                                fontWeight: 600,
                                transition: 'all 0.15s',
                                touchAction: 'manipulation',
                                flexShrink: 0,
                            }}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(148, 163, 184, 0.12)';
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(148, 163, 184, 0.06)';
                            }}
                        >
                            {t('win.restart')}
                        </button>
                        {onNextLevel && (
                            <button
                                onClick={onNextLevel}
                                style={{
                                    fontSize: 'clamp(11px, 3vw, 13px)',
                                    padding: 'clamp(8px, 2vw, 10px) clamp(16px, 4vw, 22px)',
                                    background: 'rgba(0, 255, 136, 0.08)',
                                    border: '1px solid rgba(0, 255, 136, 0.45)',
                                    color: '#00ff88',
                                    borderRadius: 10,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    letterSpacing: '0.04em',
                                    boxShadow: '0 0 12px rgba(0,255,136,0.15)',
                                    transition: 'all 0.15s',
                                    touchAction: 'manipulation',
                                    flexShrink: 0,
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0, 255, 136, 0.15)';
                                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 16px rgba(0,255,136,0.3)';
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0, 255, 136, 0.08)';
                                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 12px rgba(0,255,136,0.15)';
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
