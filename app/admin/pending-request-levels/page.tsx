'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/src/hooks/useAuth';
import type { LevelRequest } from '@/app/src/lib/firebase/firestore';
import type { LevelPart } from '@/app/src/lib/firebase/admin';
import type { CellType } from '@/app/src/games/types';
import GameCell from '@/app/src/games/components/GameCell';
import { useT, type T } from '@/app/src/contexts/LanguageContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ms: number, t: T): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('time.just_now');
  if (m < 60) return t('time.minutes_ago', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('time.hours_ago', { n: h });
  return t('time.days_ago', { n: Math.floor(h / 24) });
}

// ─── Static grid preview ───────────────────────────────────────────────────────

function GridPreview({ grid, cellSize = 20 }: { grid: CellType[][]; cellSize?: number }) {
  return (
    <div style={{ display: 'inline-block', background: '#060d1a', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(30,58,95,0.4)' }}>
      {grid.map((row, r) => (
        <div key={r} style={{ display: 'flex' }}>
          {row.map((cell, c) => (
            <GameCell key={c} cellType={cell} cellSize={cellSize} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<number, string> = { 1: '#00ff88', 2: '#fbbf24', 3: '#f97316', 4: '#ef4444' };

const CELL_FILTER_KEYS = [
  { key: 'admin.cell_ice', types: ['ice'] },
  { key: 'admin.cell_teleporter', types: ['teleporter_in_A', 'teleporter_out_A', 'teleporter_in_B', 'teleporter_out_B', 'teleporter_in_C', 'teleporter_out_C'] },
  { key: 'admin.cell_power', types: ['power_node'] },
  { key: 'admin.cell_conveyor', types: ['conveyor_up', 'conveyor_down', 'conveyor_left', 'conveyor_right'] },
  { key: 'admin.cell_toggle', types: ['direction_toggle'] },
  { key: 'admin.cell_forbidden', types: ['forbidden'] },
] as const;

// ─── Request row ───────────────────────────────────────────────────────────────

interface RequestRowProps {
  req: LevelRequest;
  parts: LevelPart[];
  onApprove: (req: LevelRequest, partId: string) => Promise<void>;
  onReject: (req: LevelRequest, note?: string) => Promise<void>;
}

function RequestRow({ req, parts, onApprove, onReject }: RequestRowProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [selectedPart, setSelectedPart] = useState(parts[0]?.partId ?? '1');
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);

  const iStyle: React.CSSProperties = {
    background: '#060d1a', border: '1px solid rgba(30,58,95,0.6)',
    color: '#94a3b8', borderRadius: 6, padding: '4px 8px', fontSize: 11,
    outline: 'none', boxSizing: 'border-box',
  };

  const handleApprove = async () => {
    setBusy(true);
    await onApprove(req, selectedPart);
    setBusy(false);
  };

  const handleReject = async () => {
    setBusy(true);
    await onReject(req, rejectNote || undefined);
    setBusy(false);
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(30,58,95,0.35)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {req.name}
          </span>
          <span style={{ fontSize: 11, color: '#475569' }}>
            by <span style={{ color: '#a78bfa' }}>{req.creatorName}</span>
            {req.creatorTag && <span style={{ color: '#475569' }}> #{req.creatorTag}</span>}
            &nbsp;·&nbsp;{req.width}×{req.height}
            {req.difficulty != undefined && <span style={{ color: DIFFICULTY_COLORS[req.difficulty], fontWeight: 700 }}>&nbsp;·&nbsp;{t(`difficulty.${req.difficulty}`)}</span>}
            &nbsp;·&nbsp;{timeAgo(req.submittedAt, t)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => { setExpanded((v) => !v); setApproving(false); setRejecting(false); }}
            style={{ padding: '5px 12px', fontSize: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#475569', borderRadius: 6, cursor: 'pointer' }}
          >
            {expanded ? t('admin.preview_close') : t('admin.preview_open')}
          </button>
          <button
            onClick={() => { setApproving((v) => !v); setRejecting(false); }}
            style={{ padding: '5px 12px', fontSize: 11, background: approving ? 'rgba(0,255,136,0.12)' : 'rgba(0,255,136,0.05)', border: `1px solid ${approving ? 'rgba(0,255,136,0.6)' : 'rgba(0,255,136,0.3)'}`, color: '#00ff88', borderRadius: 6, cursor: 'pointer' }}
          >
            {t('admin.approve')}
          </button>
          <button
            onClick={() => { setRejecting((v) => !v); setApproving(false); }}
            style={{ padding: '5px 12px', fontSize: 11, background: rejecting ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.05)', border: `1px solid ${rejecting ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.3)'}`, color: '#ef4444', borderRadius: 6, cursor: 'pointer' }}
          >
            {t('admin.reject')}
          </button>
        </div>
      </div>

      {/* Expanded: preview + action panels */}
      {(expanded || approving || rejecting) && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(30,58,95,0.25)', paddingTop: 14, display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {/* Grid preview */}
          {expanded && (
            <GridPreview grid={req.grid as CellType[][]} cellSize={Math.max(14, Math.min(24, Math.floor(200 / req.width)))} />
          )}

          {/* Approve panel */}
          {approving && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1e3a5f', display: 'block', marginBottom: 8 }}>{t('admin.which_part')}</span>
              <select
                value={selectedPart}
                onChange={(e) => setSelectedPart(e.target.value)}
                style={{ ...iStyle, width: '100%', marginBottom: 10 }}
              >
                {parts.length === 0 ? (
                  <option value="1">Part 1</option>
                ) : (
                  parts.map((p) => (
                    <option key={p.partId} value={p.partId}>
                      Part {p.partId} — {p.name}
                    </option>
                  ))
                )}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleApprove}
                  disabled={busy}
                  style={{ padding: '7px 18px', fontSize: 12, fontWeight: 700, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.5)', color: '#00ff88', borderRadius: 7, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? '...' : t('admin.approve_publish')}
                </button>
                <button
                  onClick={() => setApproving(false)}
                  style={{ padding: '7px 14px', fontSize: 12, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#475569', borderRadius: 7, cursor: 'pointer' }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Reject panel */}
          {rejecting && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1e3a5f', display: 'block', marginBottom: 8 }}>{t('admin.reject_reason_label')}</span>
              <input
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder={t('admin.reject_reason_placeholder')}
                style={{ ...iStyle, width: '100%', marginBottom: 10 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleReject}
                  disabled={busy}
                  style={{ padding: '7px 18px', fontSize: 12, fontWeight: 700, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444', borderRadius: 7, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? '...' : t('admin.reject_confirm')}
                </button>
                <button
                  onClick={() => setRejecting(false)}
                  style={{ padding: '7px 14px', fontSize: 12, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#475569', borderRadius: 7, cursor: 'pointer' }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Admin Page ────────────────────────────────────────────────────────────────

// ─── Admin Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const t = useT();
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [requests, setRequests] = useState<LevelRequest[]>([]);
  const [parts, setParts] = useState<LevelPart[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<number | null>(null);
  const [filterCellTypes, setFilterCellTypes] = useState<Set<string>>(new Set());

  // Redirect non-admins
  useEffect(() => {
    if (!loading && role !== 'admin') router.replace('/');
  }, [loading, role, router]);

  // Load requests + parts
  useEffect(() => {
    if (role !== 'admin') return;
    (async () => {
      const [{ getLevelRequests }, { getAllParts }] = await Promise.all([
        import('@/app/src/lib/firebase/firestore'),
        import('@/app/src/lib/firebase/admin'),
      ]);
      const [reqs, allParts] = await Promise.all([
        getLevelRequests('pending'),
        getAllParts(),
      ]);
      setRequests(reqs);
      setParts(allParts);
      setDataLoading(false);
    })();
  }, [role]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const handleApprove = useCallback(async (req: LevelRequest, partId: string) => {
    if (!user) return;
    const { approveLevelRequest } = await import('@/app/src/lib/firebase/admin');
    await approveLevelRequest(req.id, partId, req, user.uid);
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    showToast(t('admin.approved_toast', { name: req.name, part: partId }));
  }, [showToast]);

  const handleReject = useCallback(async (req: LevelRequest, note?: string) => {
    const { rejectLevelRequest } = await import('@/app/src/lib/firebase/admin');
    await rejectLevelRequest(req.id, note);
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    showToast(t('admin.rejected_toast', { name: req.name }));
  }, [showToast]);

  // Filtered requests
  const filteredRequests = requests.filter((req) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!req.name.toLowerCase().includes(q) && !req.creatorName.toLowerCase().includes(q)) return false;
    }
    if (filterDifficulty !== null && (req.difficulty ?? null) !== filterDifficulty) return false;
    if (filterCellTypes.size > 0) {
      const flat = (req.grid as string[][]).flat();
      const hasAll = [...filterCellTypes].every((ct) => flat.includes(ct));
      if (!hasAll) return false;
    }
    return true;
  });

  const toggleCellType = (types: readonly string[]) => {
    setFilterCellTypes((prev) => {
      const next = new Set(prev);
      const allIn = types.every((t) => next.has(t));
      if (allIn) types.forEach((t) => next.delete(t));
      else types.forEach((t) => next.add(t));
      return next;
    });
  };

  if (loading || role !== 'admin') {
    return (
      <main style={{ minHeight: '100dvh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em' }}>{t('common.loading')}</span>
      </main>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#030712', color: '#e2e8f0', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: 'rgba(3,7,18,0.97)', borderBottom: '1px solid rgba(251,191,36,0.15)' }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer', letterSpacing: '0.06em' }}
        >
          {t('common.back_menu')}
        </button>
        <h1 style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#fbbf24', textShadow: '0 0 12px rgba(251,191,36,0.5)' }}>
          {t('admin.title')}
        </h1>
        <span style={{ fontSize: 11, color: '#334155' }}>
          {dataLoading ? '...' : t('admin.pending_count', { n: requests.length })}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 800, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
        {dataLoading ? (
          <div style={{ textAlign: 'center', color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em', paddingTop: 60 }}>
            {t('common.loading')}
          </div>
        ) : (
          <>
            {/* ── Filter bar ── */}
            <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(251,191,36,0.1)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('admin.search_placeholder')}
                  style={{ flex: 1, minWidth: 160, background: '#060d1a', border: '1px solid rgba(30,58,95,0.6)', color: '#94a3b8', borderRadius: 6, padding: '5px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => setFilterDifficulty(null)}
                    style={{ padding: '4px 10px', fontSize: 10, borderRadius: 5, border: `1px solid ${filterDifficulty === null ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.1)'}`, background: filterDifficulty === null ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.02)', color: filterDifficulty === null ? '#fbbf24' : '#475569', cursor: 'pointer' }}
                  >{t('admin.difficulty_all')}</button>
                  {[1, 2, 3, 4].map((d) => (
                    <button
                      key={d}
                      onClick={() => setFilterDifficulty(filterDifficulty === d ? null : d)}
                      style={{ padding: '4px 10px', fontSize: 10, borderRadius: 5, border: `1px solid ${filterDifficulty === d ? DIFFICULTY_COLORS[d] + '99' : 'rgba(255,255,255,0.1)'}`, background: filterDifficulty === d ? DIFFICULTY_COLORS[d] + '22' : 'rgba(255,255,255,0.02)', color: filterDifficulty === d ? DIFFICULTY_COLORS[d] : '#475569', cursor: 'pointer' }}
                    >{t(`difficulty.${d}`)}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: '#1e3a5f', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('admin.grid_content')}</span>
                {CELL_FILTER_KEYS.map((g) => {
                  const active = g.types.some((type) => filterCellTypes.has(type));
                  return (
                    <button
                      key={g.key}
                      onClick={() => toggleCellType(g.types)}
                      style={{ padding: '3px 9px', fontSize: 10, borderRadius: 5, border: `1px solid ${active ? 'rgba(0,196,255,0.5)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'rgba(0,196,255,0.12)' : 'rgba(255,255,255,0.02)', color: active ? '#00c4ff' : '#475569', cursor: 'pointer' }}
                    >{t(g.key)}</button>
                  );
                })}
                {filterCellTypes.size > 0 && (
                  <button onClick={() => setFilterCellTypes(new Set())} style={{ padding: '3px 9px', fontSize: 10, borderRadius: 5, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer' }}>{t('admin.clear_filters')}</button>
                )}
              </div>
            </div>

            {/* ── Results header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fbbf24', textShadow: '0 0 10px rgba(251,191,36,0.5)' }}>
                {t('admin.pending_requests')}
              </span>
              <span style={{ fontSize: 10, color: '#334155' }}>
                {filteredRequests.length}/{requests.length}
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(251,191,36,0.15)' }} />
            </div>

            {filteredRequests.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 40 }}>
                <p style={{ color: '#1e3a5f', fontSize: 13, letterSpacing: '0.06em' }}>
                  {requests.length === 0 ? t('admin.no_pending') : t('admin.no_match')}
                </p>
              </div>
            ) : (
              filteredRequests.map((req) => (
                <RequestRow
                  key={req.id}
                  req={req}
                  parts={parts}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(6,13,26,0.96)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 10, padding: '10px 20px', fontSize: 13, color: '#fbbf24', zIndex: 100, boxShadow: '0 0 20px rgba(251,191,36,0.2)', pointerEvents: 'none' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
