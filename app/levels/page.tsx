'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { localClear, type StoredLevel } from '@/app/src/lib/db';
import { useAuth } from '@/app/src/hooks/useAuth';

type LevelEntry = StoredLevel & { id: number };

export default function LevelsPage() {
  const router = useRouter();
  const { isModerator } = useAuth();
  const [presets, setPresets] = useState<LevelEntry[]>([]);
  const [userLevels, setUserLevels] = useState<LevelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<LevelEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 600); }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const reload = useCallback(async () => {
    const { getOrderedLevels, getPresetLevels } = await import('@/app/src/lib/db');
    const [presetData, userData] = await Promise.all([getPresetLevels(), getOrderedLevels()]);
    setPresets(presetData as LevelEntry[]);
    setUserLevels(userData as LevelEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Sync level metadata from Firestore on every page open (5-min cooldown)
  useEffect(() => {
    import('@/app/src/lib/firebase/sync').then(({ syncLevelsMeta }) => {
      syncLevelsMeta().then(() => reload()).catch((err) =>
        console.warn('[Sync] Meta sync failed:', err),
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    try {
      const { syncLevelsMeta } = await import('@/app/src/lib/firebase/sync');
      await syncLevelsMeta(true); // force = true: cooldown'u atla
    } catch (err) {
      console.warn('[Sync] Refresh failed:', err);
    }
    await reload();
    setSyncing(false);
  }, [reload]);

  // ── Reorder (user levels only) ─────────────────────────────────────────
  const move = useCallback(async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= userLevels.length) return;
    const next = [...userLevels];
    [next[index], next[target]] = [next[target], next[index]];
    setUserLevels(next);
    const { reorderLevels } = await import('@/app/src/lib/db');
    await reorderLevels(next.map((l) => l.id));
  }, [userLevels]);

  // ── Delete (user levels only) ──────────────────────────────────────────
  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Delete this level? This cannot be undone.')) return;
    const { deleteStoredLevel } = await import('@/app/src/lib/db');
    await deleteStoredLevel(id);
    await reload();
  }, [reload]);

  // ── Delete preset level (admin only) ─────────────────────────────────────
  const handleDeletePreset = useCallback(async (lv: LevelEntry) => {
    setDeleteConfirm(lv);
  }, []);

  const confirmDeletePreset = useCallback(async () => {
    if (!deleteConfirm?.firestoreId) return;
    setDeleting(true);
    try {
      // Find the part this level belongs to
      const { deleteFirestoreLevel, getAllParts } = await import('@/app/src/lib/firebase/admin');
      const parts = await getAllParts();
      const part = parts.find((p) =>
        p.order.some((e) => (typeof e === 'string' ? e : e.id) === deleteConfirm.firestoreId),
      );
      if (!part) {
        // Level not found in any part order — just delete the doc
        await deleteFirestoreLevel(deleteConfirm.firestoreId, '');
      } else {
        await deleteFirestoreLevel(deleteConfirm.firestoreId, part.partId);
      }
      // Remove from local Dexie presetLevels
      const { getDB } = await import('@/app/src/lib/db');
      const db = getDB();
      await db.presetLevels.delete(deleteConfirm.id);
      await reload();
    } catch (err) {
      console.error('[DeletePreset]', err);
    }
    setDeleting(false);
    setDeleteConfirm(null);
  }, [deleteConfirm, reload]);

  const cols = isMobile ? '28px 1fr 90px' : '36px 1fr 80px 80px 120px';
  const headers = isMobile ? ['#', 'Name', 'Actions'] : ['#', 'Name', 'Size', 'Order', 'Actions'];

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
          padding: isMobile ? '12px 12px' : '12px 24px',
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={localClear}
            disabled={syncing}
            title="Firestore'dan güncelle"
            style={{
              fontSize: 14, padding: '5px 10px', background: 'rgba(255,50,50,0.03)',
              border: '1px solid rgba(255,255,255,0.1)', color: syncing ? '#1e3a5f' : '#475569',
              borderRadius: 7, cursor: syncing ? 'not-allowed' : 'pointer',
              transition: 'color 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ display: 'inline-block', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>Del</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={syncing}
            title="Firestore'dan güncelle"
            style={{
              fontSize: 14, padding: '5px 10px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)', color: syncing ? '#1e3a5f' : '#475569',
              borderRadius: 7, cursor: syncing ? 'not-allowed' : 'pointer',
              transition: 'color 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ display: 'inline-block', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
          </button>
          <button
            onClick={() => router.push('/editor')}
            style={{
              fontSize: 12, padding: '6px 12px', fontWeight: 700, letterSpacing: '0.06em',
              background: 'rgba(0,196,255,0.06)', border: '1px solid rgba(0,196,255,0.35)',
              color: '#00c4ff', borderRadius: 7, cursor: 'pointer',
            }}
          >
            {isMobile ? '+ New' : '+ New Level'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 720, width: '100%', margin: '0 auto', padding: isMobile ? '16px 8px' : '24px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em', paddingTop: 60 }}>
            LOADING...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            {/* Campaign section */}
            {presets.length > 0 && (
              <section>
                <SectionHeader label="Campaign" color="#ffd700" />
                <LevelTable cols={cols} headers={headers}>
                  {presets.map((lv, idx) => (
                    <LevelRow
                      key={lv.id}
                      level={lv}
                      index={idx}
                      total={presets.length}
                      isPreset
                      isAdmin={isModerator}
                      isMobile={isMobile}
                      cols={cols}
                      onPlay={() => router.push(`/game?id=${lv.id}&source=preset`)}
                      onEdit={() => lv.firestoreId ? router.push(`/editor?firestoreId=${lv.firestoreId}`) : undefined}
                      onDelete={() => handleDeletePreset(lv)}
                      onMoveUp={() => { }}
                      onMoveDown={() => { }}
                    />
                  ))}
                </LevelTable>
              </section>
            )}

            {/* Custom section */}
            <section>
              <SectionHeader label="Custom" color="#00c4ff" />
              {userLevels.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 24 }}>
                  <p style={{ color: '#1e3a5f', fontSize: 13, letterSpacing: '0.06em' }}>No custom levels yet.</p>
                  <button
                    onClick={() => router.push('/editor')}
                    style={{
                      padding: '10px 28px', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                      background: 'rgba(0,196,255,0.06)', border: '1px solid rgba(0,196,255,0.4)',
                      color: '#00c4ff', borderRadius: 10, cursor: 'pointer',
                    }}
                  >
                    Create First Level
                  </button>
                </div>
              ) : (
                <LevelTable cols={cols} headers={headers}>
                  {userLevels.map((lv, idx) => (
                    <LevelRow
                      key={lv.id}
                      level={lv}
                      index={idx}
                      total={userLevels.length}
                      isPreset={false}
                      isMobile={isMobile}
                      cols={cols}
                      onPlay={() => router.push(`/game?id=${lv.id}`)}
                      onEdit={() => router.push(`/editor?id=${lv.id}`)}
                      onDelete={() => handleDelete(lv.id)}
                      onMoveUp={() => move(idx, -1)}
                      onMoveDown={() => move(idx, 1)}
                    />
                  ))}
                </LevelTable>
              )}
            </section>

          </div>
        )}
      </div>
      {/* ── Delete preset confirmation dialog ── */}
      {deleteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.88)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !deleting && setDeleteConfirm(null)}
        >
          <div
            style={{ background: '#0a0f1a', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 14, padding: '24px 28px', maxWidth: 360, width: '100%', boxShadow: '0 0 40px rgba(239,68,68,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#ef4444', letterSpacing: '0.05em' }}>
              Emin misiniz?
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 6px' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>"{deleteConfirm.name}"</span> adlı kampanya leveli kalıcı olarak silinecek.
            </p>
            <p style={{ fontSize: 11, color: '#334155', margin: '0 0 20px' }}>
              Bu işlem Firestore'dan da kaldırır ve geri alınamaz.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={confirmDeletePreset}
                disabled={deleting}
                style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444', borderRadius: 8, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? '...' : 'Evet, Sil'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                style={{ padding: '8px 16px', fontSize: 13, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#475569', borderRadius: 8, cursor: 'pointer' }}
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Kolay', 2: 'Orta', 3: 'Zor', 4: 'Çok Zor' };
const DIFFICULTY_COLORS: Record<number, string> = { 1: '#00ff88', 2: '#fbbf24', 3: '#f97316', 4: '#ef4444' };

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color, textShadow: `0 0 10px ${color}80` }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: `${color}20` }} />
    </div>
  );
}

// ─── Level Table ──────────────────────────────────────────────────────────────

function LevelTable({ children, cols, headers }: { children: React.ReactNode; cols: string; headers: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: cols,
          gap: 8,
          padding: '0 12px 6px',
          borderBottom: '1px solid rgba(30,58,95,0.4)',
        }}
      >
        {headers.map((h) => (
          <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1e3a5f' }}>{h}</span>
        ))}
      </div>
      {children}
    </div>
  );
}

// ─── Level Row ────────────────────────────────────────────────────────────────

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

function LevelRow({ level, index, total, isPreset, isAdmin, isMobile, cols, onPlay, onEdit, onDelete, onMoveUp, onMoveDown }: RowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: cols,
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
            {DIFFICULTY_LABELS[level.difficulty]}
          </span>
        )}
        {isPreset && level.isNeedSync && (
          <span style={{ fontSize: 9, color: '#fbbf24', letterSpacing: '0.04em', flexShrink: 0 }}>↻</span>
        )}
        {isPreset && !level.isNeedSync && (
          <span style={{ fontSize: 9, color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 3, padding: '1px 4px', letterSpacing: '0.06em', flexShrink: 0 }}>PRESET</span>
        )}
      </div>

      {/* Size — hidden on mobile */}
      {!isMobile && (
        <span style={{ fontSize: 11, color: '#475569' }}>{level.width}×{level.height}</span>
      )}

      {/* Order buttons — hidden on mobile */}
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

      {/* Actions */}
      <div style={{ display: 'flex', gap: 5 }}>
        <ActionBtn onClick={onPlay} color="#00ff88" label="▶" title="Play" />
        {(!isPreset || isAdmin) && (
          <>
            <ActionBtn onClick={onEdit} color="#00c4ff" label="✎" title="Edit" />
            <ActionBtn onClick={onDelete} color="#ef4444" label="✕" title="Delete" />
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
