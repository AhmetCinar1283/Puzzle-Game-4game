'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../hooks/useGameEngine';
import GameBoard from './GameBoard';
import { Entity } from '../logic/entityTypes';
import { Cell } from '../logic/cellTypes';
import { ActionIntent, Direction, UIEvent, UIButtonType } from '../logic/types';
import { LevelEdges } from '../logic/engine/getNextTopologyPosition';
import { useSoundManager } from '@/app/src/games/hooks/useSoundManager';
import { useT } from '@/app/src/contexts/LanguageContext';

// Native hücre boyutu — GameBoard ve PhysicsWrapper bunu sabit 64px kullanır.
// Biz bunu CSS scale ile ölçekliyoruz, bu dosyalar DEĞİŞMEZ.
const NATIVE_CELL_SIZE = 64;
const HUD_HEIGHT = 52; // px — HUD'un sabit yüksekliği

const KEY_TO_DIRECTION: Record<string, Direction> = {
    ArrowUp:    'up',
    ArrowDown:  'down',
    ArrowLeft:  'left',
    ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
};

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
    up: 'down', down: 'up', left: 'right', right: 'left',
};

const TEXT_COLORS: Record<string, string> = {
    info:    '#00c4ff',
    warning: '#fbbf24',
    success: '#00ff88',
    error:   '#ef4444',
};

const OBJECT_NEON: Record<number, { color: string; label: string; glow: string }> = {
    1: { color: '#00ff88', label: 'P1', glow: '0 0 6px rgba(0,255,136,0.7)' },
    2: { color: '#00c4ff', label: 'P2', glow: '0 0 6px rgba(0,196,255,0.7)' },
};

const REASON_KEYS = {
    forbidden: { icon: '⚠', titleKey: 'lost.forbidden_title', msgKey: 'lost.forbidden_msg' },
    lava_edge: { icon: '☠', titleKey: 'lost.lava_title',     msgKey: 'lost.lava_msg' },
    trail:     { icon: '✗', titleKey: 'lost.trail_title',    msgKey: 'lost.trail_msg' },
    crushed:   { icon: '💥', titleKey: 'lost.crushed_title', msgKey: 'lost.crushed_msg' },
};

interface PlayScreenProps {
    levelName?: string;
    initialEntities: Entity[];
    initialGrid: Cell[][];
    levelEdges?: LevelEdges;
    onMoveExecuted?: (direction: Direction) => void;
    onButtonPressed?: (buttonType: UIButtonType) => void;
}

export function PlayScreen({
    levelName,
    initialEntities,
    initialGrid,
    levelEdges,
    onMoveExecuted,
    onButtonPressed,
}: PlayScreenProps) {
    const t = useT();
    const { play, muted, toggleMute } = useSoundManager();
    const [moveCount, setMoveCount] = useState(0);

    // ── Oyun motoru ─────────────────────────────────────────────────────────
    const {
        snapshots,
        isAnimating,
        isGameOver,
        uiEvents,
        executeTurn,
        onAnimationEnd,
        clearUiEvents,
        getEntities,
    } = useGameEngine({ initialEntities, initialGrid, levelEdges });

    const isAnimatingRef = useRef(isAnimating);
    const isGameOverRef  = useRef(isGameOver);
    isAnimatingRef.current = isAnimating;
    isGameOverRef.current  = isGameOver;

    const bufferedInputRef = useRef<Direction | null>(null);

    // ── Ses tetikleyicileri ─────────────────────────────────────────────────
    const prevIsGameOver = useRef(false);
    useEffect(() => {
        if (isGameOver && !prevIsGameOver.current) {
            const hasSuccess = uiEvents.some(e => e.kind === 'text' && e.textType === 'success');
            play(hasSuccess ? 'win' : 'lose');
        }
        prevIsGameOver.current = isGameOver;
    }, [isGameOver, uiEvents, play]);

    // ── Responsive board scale hesabı ───────────────────────────────────────
    // Grid boyutlarını initial grid'den hesaplıyoruz
    const rows = initialGrid.length;
    const cols = initialGrid[0]?.length ?? 0;
    const boardPixelW = cols * NATIVE_CELL_SIZE;
    const boardPixelH = rows * NATIVE_CELL_SIZE;

    const boardAreaRef = useRef<HTMLDivElement>(null);
    const [boardScale, setBoardScale] = useState(1);

    useEffect(() => {
        function recalc() {
            if (!boardAreaRef.current) return;
            const areaW = boardAreaRef.current.clientWidth;
            const areaH = boardAreaRef.current.clientHeight;
            if (boardPixelW === 0 || boardPixelH === 0) return;
            const scaleW = areaW / boardPixelW;
            const scaleH = areaH / boardPixelH;
            // Küçük tarafı al, max 1.0 (büyütme istemiyoruz masaüstünde çok küçük levellarda)
            const scale = Math.min(scaleW, scaleH, 1.0);
            setBoardScale(scale);
        }
        recalc();
        const ro = new ResizeObserver(recalc);
        if (boardAreaRef.current) ro.observe(boardAreaRef.current);
        return () => ro.disconnect();
    }, [boardPixelW, boardPixelH]);

    // ── Klavye kontrolü ────────────────────────────────────────────────────
    const triggerMove = useCallback((rawDirection: Direction) => {
        const intents: ActionIntent[] = getEntities()
            .filter(ent => ent.type === 'player')
            .map(ent => {
                const mode = (ent.customData.mode as string) ?? 'normal';
                const direction = mode === 'reversed'
                    ? OPPOSITE_DIRECTION[rawDirection]
                    : rawDirection;
                return {
                    entityId:     ent.id,
                    type:         'mutate_entity' as const,
                    newDirection: direction,
                    newForce:     1,
                };
            });

        if (intents.length > 0) {
            executeTurn(intents);
            onMoveExecuted?.(rawDirection);
            setMoveCount(c => c + 1);
            play('move');
        }
    }, [getEntities, executeTurn, onMoveExecuted, play]);

    const handleKey = useCallback((e: KeyboardEvent) => {
        if (isGameOverRef.current) return;
        const rawDirection = KEY_TO_DIRECTION[e.key];
        if (!rawDirection) return;
        e.preventDefault();
        if (isAnimatingRef.current) {
            bufferedInputRef.current = rawDirection;
            return;
        }
        bufferedInputRef.current = null;
        triggerMove(rawDirection);
    }, [triggerMove]);

    const handleAnimationEnd = useCallback(() => {
        onAnimationEnd();
        if (bufferedInputRef.current && !isGameOverRef.current) {
            const nextDir = bufferedInputRef.current;
            bufferedInputRef.current = null;
            triggerMove(nextDir);
        }
    }, [onAnimationEnd, triggerMove]);

    useEffect(() => {
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [handleKey]);

    // ── Swipe (Touch) Kontrolü ─────────────────────────────────────────────
    // Bütün touch area'yı dinleyerek swipe yönünü tespit ediyoruz.
    // onTouchMove → e.preventDefault() ile sayfa scroll'u engelliyoruz.
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const t0 = e.touches[0];
        touchStartRef.current = { x: t0.clientX, y: t0.clientY };
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        // Scroll'u tamamen engelle
        e.preventDefault();
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current || isGameOverRef.current) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;
        touchStartRef.current = null;

        // 20px minimum eşik — yanlışlıkla tetiklenmesin
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;

        let direction: Direction;
        if (Math.abs(dx) >= Math.abs(dy)) {
            direction = dx > 0 ? 'right' : 'left';
        } else {
            direction = dy > 0 ? 'down' : 'up';
        }

        if (isAnimatingRef.current) {
            bufferedInputRef.current = direction;
        } else {
            triggerMove(direction);
        }
    }, [triggerMove]);

    // ── UI Button Handler ───────────────────────────────────────────────────
    const pendingUi = uiEvents.length > 0 ? uiEvents[uiEvents.length - 1] : null;

    const handleButtonPress = useCallback((buttonType: UIButtonType) => {
        clearUiEvents();
        bufferedInputRef.current = null;
        if (buttonType === 'restart') {
            setMoveCount(0);
        }
        onButtonPressed?.(buttonType);
    }, [clearUiEvents, onButtonPressed]);

    // ── Kazanma sonrası otomatik tetikleme ─────────────────────────────────
    // next_level eventi geldiğinde direkt onButtonPressed çağrılır,
    // UIOverlay'de hook çağrılamaz (conditional hook ihlali olur).
    useEffect(() => {
        if (pendingUi?.kind === 'button' && pendingUi.buttonType === 'next_level') {
            handleButtonPress('next_level');
        }
    }, [pendingUi, handleButtonPress]);

    // ── Render ──────────────────────────────────────────────────────────────
    // Outer wrapper: tam ekran, sabit, scroll yok
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                background: '#030712',
                overflow: 'hidden',
                userSelect: 'none',
                WebkitUserSelect: 'none',
            }}
        >
            {/* ── Premium HUD ──────────────────────────────────────────────── */}
            <div
                style={{
                    flexShrink: 0,
                    height: HUD_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 16px',
                    background: 'rgba(3, 7, 18, 0.97)',
                    borderBottom: '1px solid rgba(0, 255, 136, 0.15)',
                    boxShadow: '0 0 16px rgba(0,255,136,0.04)',
                    gap: 8,
                }}
            >
                {/* Sol: Geri butonu + Level adı */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, maxWidth: '38vw', overflow: 'hidden' }}>
                    <button
                        onClick={() => handleButtonPress('menu')}
                        title="Levels"
                        style={{
                            fontSize: 14,
                            width: 28,
                            height: 28,
                            background: 'rgba(0,255,136,0.05)',
                            border: '1px solid rgba(0,255,136,0.2)',
                            color: '#00ff88',
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s',
                            flexShrink: 0,
                            touchAction: 'manipulation',
                            lineHeight: 1,
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,136,0.12)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,136,0.05)';
                        }}
                    >
                        ←
                    </button>
                    <div
                        style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#00ff88',
                            textShadow: '0 0 8px rgba(0,255,136,0.5)',
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {levelName || 'LEVEL'}
                    </div>
                </div>

                {/* Orta: Oyuncu modları + hamle sayısı */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, justifyContent: 'center', flexWrap: 'nowrap' }}>
                    {getEntities()
                        .filter(e => e.type === 'player')
                        .map((obj) => {
                            const info = OBJECT_NEON[obj.id] ?? { color: '#bf5fff', label: `P${obj.id}`, glow: '' };
                            const mode = (obj.customData.mode as string) ?? 'normal';
                            return (
                                <div key={obj.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            backgroundColor: info.color,
                                            boxShadow: info.glow,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                        {info.label}:{' '}
                                        <span style={{ color: info.color }}>
                                            {mode === 'reversed' ? '⬇' : '⬆'}
                                        </span>
                                    </span>
                                </div>
                            );
                        })}
                    <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>
                        {t('hud.moves')}{' '}
                        <span style={{ color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                            {moveCount}
                        </span>
                    </span>
                </div>

                {/* Sağ: Ses + Yenile butonları */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <button
                        onClick={toggleMute}
                        title={muted ? t('hud.unmute') : t('hud.mute')}
                        style={{
                            fontSize: 14,
                            width: 30,
                            height: 30,
                            background: 'rgba(0,255,136,0.05)',
                            border: '1px solid rgba(0,255,136,0.2)',
                            color: muted ? '#334155' : '#00ff88',
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s',
                            flexShrink: 0,
                            touchAction: 'manipulation',
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,136,0.10)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,136,0.05)';
                        }}
                    >
                        {muted ? '🔇' : '🔊'}
                    </button>
                    <button
                        onClick={() => handleButtonPress('restart')}
                        style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            background: 'rgba(0,255,136,0.05)',
                            border: '1px solid rgba(0,255,136,0.3)',
                            color: '#00ff88',
                            borderRadius: 6,
                            cursor: 'pointer',
                            letterSpacing: '0.04em',
                            transition: 'all 0.15s',
                            whiteSpace: 'nowrap',
                            touchAction: 'manipulation',
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,136,0.12)';
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 8px rgba(0,255,136,0.3)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,136,0.05)';
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                        }}
                    >
                        {t('hud.restart')}
                    </button>
                </div>
            </div>

            {/* ── Board alanı — kalan tüm yükseklik, swipe alıcısı ───────────── */}
            <div
                ref={boardAreaRef}
                style={{
                    flex: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // Tahta etrafında küçük soluk alan — görsel nefes alanı
                    padding: '8px 10px 12px',
                    boxSizing: 'border-box',
                    // Tüm touch olayları burada yakalanır, scroll olmaz
                    touchAction: 'none',
                    position: 'relative',
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Scale wrapper — GameBoard içeriğini hiç değiştirmeden ölçekler */}
                <div
                    style={{
                        width: boardPixelW,
                        height: boardPixelH,
                        transform: `scale(${boardScale})`,
                        transformOrigin: 'center center',
                        position: 'relative',
                        // Animasyon göstergesi (köşede sarı nokta)
                    }}
                >
                    <GameBoard
                        snapshots={snapshots.length > 0 ? snapshots : null}
                        onAnimationEnd={handleAnimationEnd}
                    />

                    {/* Animasyon sırasında köşe göstergesi */}
                    {isAnimating && (
                        <div style={{
                            position: 'absolute', bottom: 6, right: 6,
                            width: 6, height: 6,
                            borderRadius: '50%',
                            background: '#fbbf24',
                            boxShadow: '0 0 6px #fbbf24',
                            pointerEvents: 'none',
                        }} />
                    )}

                </div>
            </div>

            {/* Overlay'ler — scale wrapper DİŞİNDA, position:fixed ile tam ekran */}
            {pendingUi && pendingUi.kind === 'button' && pendingUi.buttonType === 'restart' && (
                <UIOverlay
                    event={pendingUi}
                    uiEvents={uiEvents}
                    onButtonPress={handleButtonPress}
                />
            )}
            {pendingUi && pendingUi.kind === 'text' && (
                <UIOverlay
                    event={pendingUi}
                    uiEvents={uiEvents}
                    onButtonPress={handleButtonPress}
                />
            )}
        </div>
    );
}

// ── UIOverlay ───────────────────────────────────────────────────────────────
// next_level hook sorunu burada yok artık — parent'ta useEffect ile çözüldü.
// Sadece restart (LostOverlay) ve text türleri burada render edilir.

function UIOverlay({
    event,
    uiEvents,
    onButtonPress,
}: {
    event: UIEvent;
    uiEvents: UIEvent[];
    onButtonPress: (buttonType: UIButtonType) => void;
}) {
    const t = useT();

    // ── Yenilgi Overlay ──────────────────────────────────────────────────────
    if (event.kind === 'button' && event.buttonType === 'restart') {
        const errorTextEvent = [...uiEvents]
            .reverse()
            .find(e => e.kind === 'text' && e.textType === 'error');
        const errMsg = errorTextEvent && errorTextEvent.kind === 'text' ? errorTextEvent.message : '';

        let reason: 'forbidden' | 'lava_edge' | 'trail' | 'crushed' = 'forbidden';
        if (errMsg.includes('Ezildiniz')) {
            reason = 'crushed';
        } else if (errMsg.includes('düştünüz') || errMsg.includes('Lav')) {
            reason = 'lava_edge';
        } else if (errMsg.includes('izini')) {
            reason = 'trail';
        }

        const cfg = REASON_KEYS[reason];

        return (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        // Scale wrapper dışında olduğu için position:fixed ile tam ekran
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(2, 5, 14, 0.82)',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                        zIndex: 150,
                        padding: '16px',
                        boxSizing: 'border-box',
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.7, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                        style={{
                            background: 'rgba(3, 7, 18, 0.97)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            boxShadow: '0 0 40px rgba(239, 68, 68, 0.15), 0 0 80px rgba(239, 68, 68, 0.05)',
                            borderRadius: 20,
                            padding: 'clamp(20px, 5vw, 32px) clamp(24px, 6vw, 40px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 'clamp(10px, 3vw, 14px)',
                            width: 'min(88vw, 300px)',
                            boxSizing: 'border-box',
                        }}
                    >
                        <div
                            style={{
                                fontSize: 'clamp(28px, 10vw, 40px)',
                                color: '#ef4444',
                                textShadow: '0 0 16px rgba(239,68,68,0.7)',
                                lineHeight: 1,
                            }}
                        >
                            {cfg.icon}
                        </div>
                        <h2
                            style={{
                                fontSize: 'clamp(14px, 4.5vw, 20px)',
                                fontWeight: 800,
                                color: '#ef4444',
                                textShadow: '0 0 16px rgba(239,68,68,0.5)',
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                                margin: 0,
                                textAlign: 'center',
                            }}
                        >
                            {t(cfg.titleKey)}
                        </h2>
                        <p style={{ color: '#64748b', fontSize: 'clamp(11px, 3vw, 13px)', margin: 0, textAlign: 'center' }}>
                            {t(cfg.msgKey)}
                        </p>
                        <button
                            onClick={() => onButtonPress('restart')}
                            style={{
                                fontSize: 'clamp(11px, 3vw, 13px)',
                                padding: 'clamp(8px, 2vw, 10px) clamp(20px, 6vw, 28px)',
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.45)',
                                color: '#ef4444',
                                borderRadius: 10,
                                cursor: 'pointer',
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                marginTop: 4,
                                boxShadow: '0 0 12px rgba(239,68,68,0.12)',
                                transition: 'all 0.15s',
                                touchAction: 'manipulation',
                            }}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.15)';
                                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 16px rgba(239,68,68,0.25)';
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.08)';
                                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 12px rgba(239,68,68,0.12)';
                            }}
                        >
                            {t('lost.try_again')}
                        </button>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        );
    }

    // ── Yazı bildirimi ───────────────────────────────────────────────────────
    if (event.kind === 'text') {
        const color = TEXT_COLORS[event.textType] ?? '#ffffff';
        return (
            <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(3,7,18,0.78)',
                zIndex: 100,
            }}>
                <span style={{
                    color,
                    fontSize: 20,
                    fontWeight: 'bold',
                    textShadow: `0 0 18px ${color}`,
                    letterSpacing: '0.04em',
                    textAlign: 'center',
                    padding: '0 16px',
                }}>
                    {event.message}
                </span>
            </div>
        );
    }

    return null;
}
