'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { StoredLevel } from '@/app/src/lib/db';

type LevelEntry = StoredLevel & { id: number };

export default function LevelsPage() {
  const router = useRouter();
  const [levels, setLevels] = useState<LevelEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { getOrderedLevels } = await import('@/app/src/lib/db');
    const data = await getOrderedLevels();
    setLevels(data as LevelEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── Reorder ────────────────────────────────────────────────────────────
  const move = useCallback(async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= levels.length) return;
    const newLevels = [...levels];
    [newLevels[index], newLevels[target]] = [newLevels[target], newLevels[index]];
    setLevels(newLevels); // optimistic update
    const { reorderLevels } = await import('@/app/src/lib/db');
    await reorderLevels(newLevels.map((l) => l.id));
  }, [levels]);

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Delete this level? This cannot be undone.')) return;
    const { deleteStoredLevel } = await import('@/app/src/lib/db');
    await deleteStoredLevel(id);
    await reload();
  }, [reload]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#030712',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          background: 'rgba(3,7,18,0.97)',
          borderBottom: '1px solid rgba(0,255,136,0.12)',
        }}
      >
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer', letterSpacing: '0.06em' }}
        >
          ← Menu
        </button>
        <h1
          style={{
            margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: '#00ff88',
            textShadow: '0 0 12px rgba(0,255,136,0.5)',
          }}
        >
          Levels
        </h1>
        <button
          onClick={() => router.push('/editor')}
          style={{
            fontSize: 12, padding: '6px 16px', fontWeight: 700, letterSpacing: '0.06em',
            background: 'rgba(0,196,255,0.06)', border: '1px solid rgba(0,196,255,0.35)',
            color: '#00c4ff', borderRadius: 7, cursor: 'pointer',
          }}
        >
          + New Level
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 720, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em', paddingTop: 60 }}>
            LOADING...
          </div>
        ) : levels.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <p style={{ color: '#1e3a5f', fontSize: 14, letterSpacing: '0.06em' }}>No levels saved yet.</p>
            <button
              onClick={() => router.push('/editor')}
              style={{
                padding: '12px 32px', fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                background: 'rgba(0,196,255,0.06)', border: '1px solid rgba(0,196,255,0.4)',
                color: '#00c4ff', borderRadius: 10, cursor: 'pointer',
              }}
            >
              Create First Level
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Header */}
            <div
              style={{
                display: 'grid', gridTemplateColumns: '36px 1fr 80px 80px 120px',
                gap: 8, padding: '0 12px 8px',
                borderBottom: '1px solid rgba(30,58,95,0.4)',
              }}
            >
              {['#', 'Name', 'Size', 'Order', 'Actions'].map((h) => (
                <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1e3a5f' }}>{h}</span>
              ))}
            </div>

            {levels.map((lv, idx) => (
              <LevelRow
                key={lv.id}
                level={lv}
                index={idx}
                total={levels.length}
                onPlay={() => router.push(`/game?id=${lv.id}`)}
                onEdit={() => router.push(`/editor?id=${lv.id}`)}
                onDelete={() => handleDelete(lv.id)}
                onMoveUp={() => move(idx, -1)}
                onMoveDown={() => move(idx, 1)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Level Row ────────────────────────────────────────────────────────────────

interface RowProps {
  level: LevelEntry;
  index: number;
  total: number;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function LevelRow({ level, index, total, onPlay, onEdit, onDelete, onMoveUp, onMoveDown }: RowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr 80px 80px 120px',
        gap: 8,
        alignItems: 'center',
        padding: '10px 12px',
        background: hovered ? 'rgba(0,255,136,0.04)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hovered ? 'rgba(0,255,136,0.2)' : 'rgba(30,58,95,0.3)'}`,
        borderRadius: 8,
        transition: 'all 0.15s',
      }}
    >
      {/* # */}
      <span style={{ fontSize: 13, color: '#1e3a5f', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
        {index + 1}
      </span>

      {/* Name */}
      <div>
        <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>{level.name}</span>
        {level.trailCollision && (
          <span style={{ marginLeft: 8, fontSize: 9, color: '#00c4ff', border: '1px solid rgba(0,196,255,0.35)', borderRadius: 3, padding: '1px 4px', letterSpacing: '0.06em' }}>TRAIL</span>
        )}
      </div>

      {/* Size */}
      <span style={{ fontSize: 11, color: '#475569' }}>{level.width}×{level.height}</span>

      {/* Order buttons */}
      <div style={{ display: 'flex', gap: 4 }}>
        <ArrowBtn onClick={onMoveUp} disabled={index === 0} label="↑" />
        <ArrowBtn onClick={onMoveDown} disabled={index === total - 1} label="↓" />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 5 }}>
        <ActionBtn onClick={onPlay} color="#00ff88" label="▶" title="Play" />
        <ActionBtn onClick={onEdit} color="#00c4ff" label="✎" title="Edit" />
        <ActionBtn onClick={onDelete} color="#ef4444" label="✕" title="Delete" />
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
        borderRadius: 5, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s',
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
        border: `1px solid ${color}35`, color, borderRadius: 6,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${color}20`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${color}0d`; }}
    >
      {label}
    </button>
  );
}
