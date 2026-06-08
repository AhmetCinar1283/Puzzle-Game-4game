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
  gamepadSelected?: boolean;
}

export function LevelRow({
  level, index, total, isPreset, isAdmin, isMobile, playedLevel, isLocked,
  onPlay, onEdit, onDelete, onMoveUp, onMoveDown, gamepadSelected,
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

  const diffColor = level.difficulty ? DIFF_COLOR[level.difficulty] : undefined;
  const diffBg = level.difficulty ? DIFF_BG[level.difficulty] : undefined;

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerMove={cancelLongPress}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: 144,
          padding: '12px 14px',
          background: hovered || gamepadSelected
            ? 'rgba(17, 24, 39, 0.9)'
            : 'rgba(13, 20, 37, 0.45)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${hovered || gamepadSelected
            ? (diffColor || '#00c4ff')
            : 'rgba(255, 255, 255, 0.08)'}`,
          borderRadius: 12,
          cursor: locked ? 'not-allowed' : 'pointer',
          boxShadow: hovered || gamepadSelected
            ? `0 0 15px ${(diffColor || '#00c4ff')}40, inset 0 0 10px ${(diffColor || '#00c4ff')}20`
            : '0 8px 24px rgba(0, 0, 0, 0.35)',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          userSelect: 'none',
          outline: 'none',
        }}
      >
        {/* Top Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
          {/* Left: Index tag and Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              color: diffColor || '#00c4ff',
              background: diffColor ? `${diffColor}15` : 'rgba(0, 196, 255, 0.15)',
              border: `1px solid ${diffColor ? `${diffColor}40` : 'rgba(0, 196, 255, 0.3)'}`,
              borderRadius: 4,
              padding: '2px 5px',
              fontFamily: 'monospace',
              flexShrink: 0,
            }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span style={{
              fontSize: 13,
              fontWeight: 700,
              color: locked ? '#475569' : '#f1f5f9',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {locked ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#475569' }}>
                  🔒 {t('levels.locked') || 'Kilitli'}
                </span>
              ) : level.name}
            </span>
          </div>
          
          {/* Right: Difficulty Pill */}
          {level.difficulty && (
            <span style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: diffColor,
              background: `${diffColor}12`,
              border: `1px solid ${diffColor}30`,
              borderRadius: 4,
              padding: '1px 5px',
              flexShrink: 0,
            }}>
              {t(`difficulty.${level.difficulty}`)}
            </span>
          )}
        </div>

        {/* Middle Row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
              {level.width}×{level.height} Grid
            </span>
            {level.creatorName && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>•</span>
                <span style={{ fontSize: 11, color: '#00c4ff', fontWeight: 600, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={level.creatorName}>
                  by {level.creatorName}
                </span>
              </>
            )}
          </div>
          
          {level.trailCollision && (
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 1 }}>
              <span style={{
                fontSize: 9,
                fontWeight: 800,
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 3,
                padding: '1px 4px',
                letterSpacing: '0.05em',
              }}>
                ⚡ {t('editor.trail_collision') || 'TRAIL'}
              </span>
            </div>
          )}
        </div>

        {/* Bottom Row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', marginTop: 'auto' }}>
          {/* Left: StarDisplay & Played Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {playedLevel ? (
              <>
                <StarDisplay stars={playedLevel.stars || 1} />
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, marginTop: 1 }}>
                  {playedLevel.moveCount} {t('hud.moves')?.replace(':', '') || 'Hamle'} · {formatTime(playedLevel.timeSpent)}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 10, color: '#475569', fontStyle: 'italic' }}>
                {t('levels.not_played') || 'Oynanmadı'}
              </span>
            )}
          </div>

          {/* Right: Quick Action Buttons & Play Trigger */}
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={(e) => e.stopPropagation()} // Prevent card play click when clicking small control buttons
          >
            {canAct && (hovered || gamepadSelected || !isMobile) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {!isPreset && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <ArrowBtn onClick={onMoveUp} disabled={index === 0} label="▲" />
                    <ArrowBtn onClick={onMoveDown} disabled={index >= total - 1} label="▼" />
                  </div>
                )}
                <SmallBtn onClick={onEdit} color="#00c4ff" label="✎" title={t('list.edit')} />
                <SmallBtn onClick={onDelete} color="#ef4444" label="✕" title={t('list.delete')} />
              </div>
            )}

            {/* Main Action Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!locked) onPlay();
              }}
              disabled={locked}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: locked
                  ? 'rgba(71, 85, 105, 0.1)'
                  : `linear-gradient(135deg, ${(diffColor || '#00c4ff')}15 0%, ${(diffColor || '#00c4ff')}30 100%)`,
                border: `1px solid ${locked ? 'rgba(71, 85, 105, 0.2)' : `${(diffColor || '#00c4ff')}60`}`,
                color: locked ? '#475569' : '#fff',
                cursor: locked ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: locked ? 'none' : `0 0 10px ${(diffColor || '#00c4ff')}20`,
                fontSize: 12,
                transition: 'all 0.2s ease',
              }}
            >
              {locked ? '🔒' : '▶'}
            </button>
          </div>
        </div>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          isPreset={isPreset}
          index={index}
          total={total}
          onEdit={onEdit}
          onDelete={onDelete}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
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
