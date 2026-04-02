'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/src/hooks/useAuth';
import type { LevelRequest } from '@/app/src/lib/firebase/firestore';
import type { LevelPart } from '@/app/src/lib/firebase/admin';
import type { CellType } from '@/app/src/games/types';
import GameCell from '@/app/src/games/components/GameCell';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'az önce';
  if (m < 60) return `${m}dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa önce`;
  return `${Math.floor(h / 24)}g önce`;
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

// ─── Request row ───────────────────────────────────────────────────────────────

interface RequestRowProps {
  req: LevelRequest;
  parts: LevelPart[];
  onApprove: (req: LevelRequest, partId: string) => Promise<void>;
  onReject: (req: LevelRequest, note?: string) => Promise<void>;
}

function RequestRow({ req, parts, onApprove, onReject }: RequestRowProps) {
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
            &nbsp;·&nbsp;{req.width}×{req.height}&nbsp;·&nbsp;{timeAgo(req.submittedAt)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => { setExpanded((v) => !v); setApproving(false); setRejecting(false); }}
            style={{ padding: '5px 12px', fontSize: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#475569', borderRadius: 6, cursor: 'pointer' }}
          >
            {expanded ? 'Kapat ▲' : 'Önizle ▼'}
          </button>
          <button
            onClick={() => { setApproving((v) => !v); setRejecting(false); }}
            style={{ padding: '5px 12px', fontSize: 11, background: approving ? 'rgba(0,255,136,0.12)' : 'rgba(0,255,136,0.05)', border: `1px solid ${approving ? 'rgba(0,255,136,0.6)' : 'rgba(0,255,136,0.3)'}`, color: '#00ff88', borderRadius: 6, cursor: 'pointer' }}
          >
            Onayla ▸
          </button>
          <button
            onClick={() => { setRejecting((v) => !v); setApproving(false); }}
            style={{ padding: '5px 12px', fontSize: 11, background: rejecting ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.05)', border: `1px solid ${rejecting ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.3)'}`, color: '#ef4444', borderRadius: 6, cursor: 'pointer' }}
          >
            Reddet
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
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1e3a5f', display: 'block', marginBottom: 8 }}>Hangi parta eklensin?</span>
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
                  {busy ? '...' : '✓ Onayla ve Yayınla'}
                </button>
                <button
                  onClick={() => setApproving(false)}
                  style={{ padding: '7px 14px', fontSize: 12, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#475569', borderRadius: 7, cursor: 'pointer' }}
                >
                  İptal
                </button>
              </div>
            </div>
          )}

          {/* Reject panel */}
          {rejecting && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1e3a5f', display: 'block', marginBottom: 8 }}>Red sebebi (opsiyonel)</span>
              <input
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Level neden reddedildi?"
                style={{ ...iStyle, width: '100%', marginBottom: 10 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleReject}
                  disabled={busy}
                  style={{ padding: '7px 18px', fontSize: 12, fontWeight: 700, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444', borderRadius: 7, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? '...' : '✕ Reddet'}
                </button>
                <button
                  onClick={() => setRejecting(false)}
                  style={{ padding: '7px 14px', fontSize: 12, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#475569', borderRadius: 7, cursor: 'pointer' }}
                >
                  İptal
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

export default function AdminPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [requests, setRequests] = useState<LevelRequest[]>([]);
  const [parts, setParts] = useState<LevelPart[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [toast, setToast] = useState('');

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
    showToast(`"${req.name}" onaylandı ve Part ${partId}'e eklendi.`);
  }, [showToast]);

  const handleReject = useCallback(async (req: LevelRequest, note?: string) => {
    const { rejectLevelRequest } = await import('@/app/src/lib/firebase/admin');
    await rejectLevelRequest(req.id, note);
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    showToast(`"${req.name}" reddedildi.`);
  }, [showToast]);

  if (loading || role !== 'admin') {
    return (
      <main style={{ minHeight: '100dvh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em' }}>LOADING...</span>
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
          ← Menu
        </button>
        <h1 style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#fbbf24', textShadow: '0 0 12px rgba(251,191,36,0.5)' }}>
          Admin Panel
        </h1>
        <span style={{ fontSize: 11, color: '#334155' }}>
          {dataLoading ? '...' : `${requests.length} bekleyen talep`}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 800, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
        {dataLoading ? (
          <div style={{ textAlign: 'center', color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em', paddingTop: 60 }}>
            LOADING...
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <p style={{ color: '#1e3a5f', fontSize: 13, letterSpacing: '0.06em' }}>Bekleyen level talebi yok.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fbbf24', textShadow: '0 0 10px rgba(251,191,36,0.5)' }}>
                Bekleyen Talepler
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(251,191,36,0.15)' }} />
            </div>
            {requests.map((req) => (
              <RequestRow
                key={req.id}
                req={req}
                parts={parts}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
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
