'use client';

import { useState, useRef, useCallback, type MouseEvent, type PointerEvent } from 'react';
import type { StoredLevel, StoredPlayedLevel } from '@/app/src/lib/db';
import { useT } from '@/app/src/contexts/LanguageContext';

type LevelEntry = StoredLevel & { id: number };

const DIFF_COLOR: Record<number, string> = { 1: '#00ff88', 2: '#fbbf24', 3: '#f97316', 4: '#ef4444' };
const DIFF_BG: Record<number, string> = {
  1: 'rgba(0,255,136,0.08)', 2: 'rgba(251,191,36,0.08)',
  3: 'rgba(249,115,22,0.08)', 4: 'rgba(239,68,68,0.08)',
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function StarDisplay({ stars }: { stars: 1 | 2 | 3 }) {
  return (
    <span style={{ fontSize: 11, letterSpacing: 2 }}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          style={{
            color: n <= stars ? '#ffd700' : '#1e3a5f',
            textShadow: n <= stars ? '0 0 6px rgba(255,215,0,0.5)' : 'none',
          }}
        >★</span>
      ))}
    </span>
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────

interface MenuProps {
  x: number;
  y: number;
  isPreset: boolean;
  index: number;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onClose: () => void;
  t: (key: string) => string;
}

function ContextMenu({ x, y, isPreset, index, total, onEdit, onDelete, onMoveUp, onMoveDown, onClose, t }: MenuProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 300 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      {/* Menu */}
      <div
        style={{
          position: 'fixed', left: x, top: y, zIndex: 301,
          background: 'rgba(13, 20, 37, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(0,196,255,0.25)',
          borderRadius: 10, padding: '5px 0', minWidth: 170,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(0,196,255,0.06)',
        }}
      >
        <MenuItem color="#00c4ff" icon="✎" label={t('list.edit')} onClick={() => { onEdit(); onClose(); }} />
        {!isPreset && (
          <>
            <MenuItem color="#9333ea" icon="↑" label="Yukarı taşı" onClick={() => { onMoveUp(); onClose(); }} disabled={index === 0} />
            <MenuItem color="#9333ea" icon="↓" label="Aşağı taşı" onClick={() => { onMoveDown(); onClose(); }} disabled={index >= total - 1} />
          </>
        )}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
        <MenuItem color="#ef4444" icon="✕" label={t('list.delete')} onClick={() => { onDelete(); onClose(); }} />
      </div>
    </>
  );
}

function MenuItem({
  color, icon, label, onClick, disabled,
}: {
  color: string; icon: string; label: string; onClick: () => void; disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 16px',
        background: hov && !disabled ? `${color}10` : 'none',
        border: 'none', color: disabled ? '#334155' : color,
        fontSize: 13, cursor: disabled ? 'default' : 'pointer',
        letterSpacing: '0.04em', opacity: disabled ? 0.4 : 1,
        transition: 'background 0.1s',
      }}
    >
      <span style={{ width: 14, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

export interface RowProps {
  level: LevelEntry;
  index: number;
  total: number;
  isPreset: boolean;
  isAdmin?: boolean;
  isMobile: boolean;
  cols: string; // kept for API compat, not used internally
  playedLevel?: StoredPlayedLevel;
  isLocked?: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function LevelRow({
  level, index, total, isPreset, isAdmin, isMobile, playedLevel, isLocked,
  onPlay, onEdit, onDelete, onMoveUp, onMoveDown,
}: RowProps) {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);

  const locked = isLocked ?? false;
  const canAct = !isPreset || isAdmin; // can edit/delete

  // ── Context menu helpers ──

  const openCtx = useCallback((clientX: number, clientY: number) => {
    if (!canAct) return;
    suppressClick.current = true;
    const menuW = 170, menuH = 160;
    setCtxMenu({
      x: Math.min(clientX, window.innerWidth - menuW - 8),
      y: Math.min(clientY, window.innerHeight - menuH - 8),
    });
  }, [canAct]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    if (!canAct) return;
    e.preventDefault();
    openCtx(e.clientX, e.clientY);
  }, [canAct, openCtx]);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (!canAct || e.button !== 0) return;
    longPressRef.current = setTimeout(() => openCtx(e.clientX, e.clientY), 550);
  }, [canAct, openCtx]);

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
  }, []);

  const handleClick = useCallback(() => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (!locked) onPlay();
  }, [locked, onPlay]);

  // ── Styles ──

  const diffColor = level.difficulty ? DIFF_COLOR[level.difficulty] : null;
  const diffBg = level.difficulty ? DIFF_BG[level.difficulty] : null;

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); cancelLongPress(); }}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onClick={handleClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: isMobile ? '13px 12px' : '14px 16px',
          background: locked
            ? 'rgba(255,255,255,0.01)'
            : hovered 
              ? `rgba(${level.difficulty === 1 ? '0, 255, 136' : level.difficulty === 2 ? '251, 191, 36' : level.difficulty === 3 ? '249, 115, 22' : level.difficulty === 4 ? '239, 68, 68' : '0, 255, 136'}, 0.07)` 
              : 'rgba(8, 12, 28, 0.45)',
          border: `1px solid ${locked
            ? 'rgba(30,58,95,0.18)'
            : hovered 
              ? (level.difficulty ? DIFF_COLOR[level.difficulty] : '#00ff88')
              : 'rgba(255, 255, 255, 0.06)'}`,
          borderRadius: 12, 
          boxShadow: !locked && hovered 
            ? `0 6px 20px rgba(${level.difficulty === 1 ? '0, 255, 136' : level.difficulty === 2 ? '251, 191, 36' : level.difficulty === 3 ? '249, 115, 22' : level.difficulty === 4 ? '239, 68, 68' : '0, 255, 136'}, 0.15), inset 0 0 10px rgba(255,255,255,0.02)` 
            : '0 4px 12px rgba(0,0,0,0.2)',
          transform: !locked && hovered ? 'scale(1.01) translateY(-1px)' : 'scale(1)',
          transition: 'all 0.22s cubic-bezier(0.25, 0.8, 0.25, 1)',
          opacity: locked ? 0.45 : 1,
          cursor: locked ? 'default' : 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {/* Index */}
        <span style={{
          fontSize: 11, color: '#2d4a6b', fontVariantNumeric: 'tabular-nums',
          minWidth: 24, textAlign: 'center', flexShrink: 0,
          fontWeight: 700, letterSpacing: '0.04em',
        }}>
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {/* Name + badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{
              fontSize: 14, fontWeight: 600,
              color: locked ? '#475569' : hovered ? '#e2e8f0' : '#94a3b8',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1, transition: 'color 0.15s',
            }}>
              {locked && <span style={{ marginRight: 5 }}>🔒</span>}
              {level.name}
            </span>

            {/* Difficulty pill */}
            {diffColor && diffBg && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                color: diffColor, background: diffBg,
                border: `1px solid ${diffColor}45`, borderRadius: 4,
                padding: '2px 7px', flexShrink: 0,
              }}>
                {t(`difficulty.${level.difficulty}`)}
              </span>
            )}

            {/* Grid size */}
            {!isMobile && (
              <span style={{
                fontSize: 11, color: '#2d4a6b', flexShrink: 0, fontVariantNumeric: 'tabular-nums',
              }}>
                {level.width}×{level.height}
              </span>
            )}
          </div>

          {/* Sub-info: stars, stats, tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 14 }}>
            {playedLevel?.stars != null && <StarDisplay stars={playedLevel.stars} />}

            {playedLevel && (playedLevel.moveCount != null || playedLevel.timeSpent > 0) && (
              <span style={{ fontSize: 10, color: '#334155', letterSpacing: '0.04em' }}>
                {playedLevel.moveCount != null ? `${playedLevel.moveCount} hamle` : ''}
                {playedLevel.moveCount != null && playedLevel.timeSpent > 0 ? ' · ' : ''}
                {playedLevel.timeSpent > 0 ? formatTime(playedLevel.timeSpent) : ''}
              </span>
            )}

            {isPreset && level.creatorName && (
              <span style={{ fontSize: 10, color: '#475569' }}>by {level.creatorName}</span>
            )}

            {level.trailCollision && (
              <span style={{
                fontSize: 9, color: '#00c4ff',
                border: '1px solid rgba(0,196,255,0.3)', borderRadius: 3,
                padding: '1px 5px', letterSpacing: '0.08em',
              }}>TRAIL</span>
            )}

            {isPreset && level.isNeedSync && (
              <span style={{ fontSize: 10, color: '#fbbf24', letterSpacing: '0.04em' }}>↻</span>
            )}

            {canAct && !isMobile && hovered && (
              <span style={{ fontSize: 10, color: '#1e3a5f', fontStyle: 'italic' }}>
                sağ tık →  işlemler
              </span>
            )}
          </div>
        </div>

        {/* Right: action buttons + play */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hover-reveal admin buttons (desktop) */}
          {canAct && !isMobile && (
            <div style={{
              display: 'flex', gap: 4,
              opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
              pointerEvents: hovered ? 'auto' : 'none',
            }}>
              <SmallBtn onClick={onEdit} color="#00c4ff" label="✎" title={t('list.edit')} />
              <SmallBtn onClick={onDelete} color="#ef4444" label="✕" title={t('list.delete')} />
            </div>
          )}

          {/* Move buttons (user levels, desktop) */}
          {!isPreset && !isMobile && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
              pointerEvents: hovered ? 'auto' : 'none',
            }}>
              <ArrowBtn onClick={onMoveUp} disabled={index === 0} label="↑" />
              <ArrowBtn onClick={onMoveDown} disabled={index >= total - 1} label="↓" />
            </div>
          )}

          {/* Play button */}
          <button
            onClick={(e) => { e.stopPropagation(); if (!locked) onPlay(); }}
            disabled={locked}
            title={locked ? 'Locked' : t('list.play')}
            style={{
              width: isMobile ? 42 : 46,
              height: isMobile ? 38 : 46,
              fontSize: isMobile ? 15 : 17,
              background: locked
                ? 'rgba(30,58,95,0.1)'
                : hovered ? 'rgba(0,255,136,0.14)' : 'rgba(0,255,136,0.07)',
              border: `1px solid ${locked
                ? 'rgba(30,58,95,0.3)'
                : hovered ? 'rgba(0,255,136,0.6)' : 'rgba(0,255,136,0.28)'}`,
              color: locked ? '#2d4a6b' : hovered ? '#00ff88' : '#4a9e70',
              borderRadius: 9, cursor: locked ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
              boxShadow: !locked && hovered ? '0 0 18px rgba(0,255,136,0.2), inset 0 0 10px rgba(0,255,136,0.05)' : 'none',
            }}
          >
            {locked ? '🔒' : '▶'}
          </button>
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && canAct && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          isPreset={isPreset} index={index} total={total}
          onEdit={onEdit} onDelete={onDelete}
          onMoveUp={onMoveUp} onMoveDown={onMoveDown}
          onClose={() => setCtxMenu(null)}
          t={t}
        />
      )}
    </>
  );
}

// ─── Small helper buttons ─────────────────────────────────────────────────────

function ArrowBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 22, height: 20, fontSize: 11,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        color: disabled ? '#1e3a5f' : '#475569',
        borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {label}
    </button>
  );
}

function SmallBtn({ onClick, color, label, title }: {
  onClick: () => void; color: string; label: string; title: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 32, height: 32, fontSize: 13,
        background: hov ? `${color}20` : `${color}0d`,
        border: `1px solid ${hov ? `${color}60` : `${color}30`}`,
        color, borderRadius: 7, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  );
}
