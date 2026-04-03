'use client';

import { useState } from 'react';
import type { StoredLevel } from '@/app/src/lib/db';
import { useT } from '@/app/src/contexts/LanguageContext';

type LevelEntry = StoredLevel & { id: number };

const DIFFICULTY_COLORS: Record<number, string> = { 1: '#00ff88', 2: '#fbbf24', 3: '#f97316', 4: '#ef4444' };

interface RowProps {
  level: LevelEntry;
  index: number;
  total: number;
  isPreset: boolean;
  isAdmin?: boolean;
  isMobile: boolean;
  cols: string;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function LevelRow({ level, index, total, isPreset, isAdmin, isMobile, cols, onPlay, onEdit, onDelete, onMoveUp, onMoveDown }: RowProps) {
  const t = useT();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center',
        padding: '10px 12px',
        background: hovered ? 'rgba(0,255,136,0.04)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hovered ? 'rgba(0,255,136,0.2)' : 'rgba(30,58,95,0.3)'}`,
        borderRadius: 8, transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: 13, color: '#1e3a5f', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
        {index + 1}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{level.name}</span>
          {isPreset && level.creatorName && (
            <span style={{ fontSize: 9, color: '#475569', display: 'block', marginTop: 1 }}>by {level.creatorName}</span>
          )}
        </div>
        {level.trailCollision && (
          <span style={{ fontSize: 9, color: '#00c4ff', border: '1px solid rgba(0,196,255,0.35)', borderRadius: 3, padding: '1px 4px', letterSpacing: '0.06em', flexShrink: 0 }}>TRAIL</span>
        )}
        {isPreset && level.difficulty && (
          <span style={{ fontSize: 9, color: DIFFICULTY_COLORS[level.difficulty], border: `1px solid ${DIFFICULTY_COLORS[level.difficulty]}40`, borderRadius: 3, padding: '1px 4px', letterSpacing: '0.06em', flexShrink: 0 }}>
            {t(`difficulty.${level.difficulty}`)}
          </span>
        )}
        {isPreset && level.isNeedSync && (
          <span style={{ fontSize: 9, color: '#fbbf24', letterSpacing: '0.04em', flexShrink: 0 }}>↻</span>
        )}
        {isPreset && !level.isNeedSync && (
          <span style={{ fontSize: 9, color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 3, padding: '1px 4px', letterSpacing: '0.06em', flexShrink: 0 }}>PRESET</span>
        )}
      </div>

      {!isMobile && (
        <span style={{ fontSize: 11, color: '#475569' }}>{level.width}×{level.height}</span>
      )}

      {!isMobile && (
        <div style={{ display: 'flex', gap: 4 }}>
          {isPreset ? (
            <span style={{ fontSize: 11, color: '#1e3a5f' }}>—</span>
          ) : (
            <>
              <ArrowBtn onClick={onMoveUp} disabled={index === 0} label="↑" />
              <ArrowBtn onClick={onMoveDown} disabled={index === total - 1} label="↓" />
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 5 }}>
        <ActionBtn onClick={onPlay} color="#00ff88" label="▶" title={t('list.play')} />
        {(!isPreset || isAdmin) && (
          <>
            <ActionBtn onClick={onEdit} color="#00c4ff" label="✎" title={t('list.edit')} />
            <ActionBtn onClick={onDelete} color="#ef4444" label="✕" title={t('list.delete')} />
          </>
        )}
      </div>
    </div>
  );
}

function ArrowBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 26, height: 26, fontSize: 12, background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)', color: disabled ? '#1e3a5f' : '#475569',
        borderRadius: 5, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  );
}

function ActionBtn({ onClick, color, label, title }: { onClick: () => void; color: string; label: string; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 30, height: 28, fontSize: 12, background: `${color}0d`,
        border: `1px solid ${color}35`, color, borderRadius: 6, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${color}20`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${color}0d`; }}
    >
      {label}
    </button>
  );
}
