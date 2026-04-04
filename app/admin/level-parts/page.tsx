'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/src/hooks/useAuth';
import type { LevelPart, LevelOrderEntry } from '@/app/src/lib/firebase/admin';
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from '@/app/editor/editorConfig';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns entries sorted by position ascending, with index fallback for legacy data. */
function sortedEntries(order: Record<string, LevelOrderEntry>): LevelOrderEntry[] {
  return Object.values(order).sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
}
// ─── Shared styles ────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background: '#060d1a',
  border: '1px solid rgba(30,58,95,0.6)',
  color: '#e2e8f0',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
  width: '100%',
};

function NeonBtn({
  color = '#00c4ff',
  onClick,
  disabled,
  children,
  small,
}: {
  color?: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '4px 10px' : '6px 14px',
        fontSize: small ? 10 : 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        background: `${color}10`,
        border: `1px solid ${color}50`,
        color,
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${color}20`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = `${color}10`; }}
    >
      {children}
    </button>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(3,7,18,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#060d1a',
          border: '1px solid rgba(0,196,255,0.25)',
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 0 40px rgba(0,196,255,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00c4ff' }}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

// ─── Level row ────────────────────────────────────────────────────────────────

function LevelRow({
  entry,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: {
  entry: LevelOrderEntry;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(30,58,95,0.3)',
        borderRadius: 8,
        marginBottom: 6,
      }}
    >
      {/* Reorder arrows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          style={{
            background: 'none', border: 'none', color: isFirst ? '#1e3a5f' : '#475569',
            cursor: isFirst ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '1px 4px',
          }}
        >▲</button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          style={{
            background: 'none', border: 'none', color: isLast ? '#1e3a5f' : '#475569',
            cursor: isLast ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '1px 4px',
          }}
        >▼</button>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.name || <span style={{ color: '#1e3a5f', fontStyle: 'italic' }}>Untitled</span>}
        </span>
        <span style={{ fontSize: 10, color: '#475569' }}>
          {entry.width}×{entry.height}
          {entry.difficulty != undefined && (
            <span style={{ color: DIFFICULTY_COLORS[entry.difficulty], fontWeight: 700 }}>
              &nbsp;·&nbsp;{DIFFICULTY_LABELS[entry.difficulty]}
            </span>
          )}
          {entry.creatorName && (
            <span style={{ color: '#a78bfa' }}>&nbsp;·&nbsp;{entry.creatorName}</span>
          )}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {confirmDelete ? (
          <>
            <NeonBtn color="#ef4444" small onClick={onDelete}>Confirm</NeonBtn>
            <NeonBtn color="#475569" small onClick={() => setConfirmDelete(false)}>Cancel</NeonBtn>
          </>
        ) : (
          <>
            <NeonBtn color="#00c4ff" small onClick={onEdit}>Edit</NeonBtn>
            <NeonBtn color="#ef4444" small onClick={() => setConfirmDelete(true)}>Delete</NeonBtn>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Part card ────────────────────────────────────────────────────────────────

function PartCard({
  part,
  onUpdateName,
  onUpdateUnlock,
  onDelete,
  onReorderLevel,
  onDeleteLevel,
  onEditLevel,
}: {
  part: LevelPart;
  onUpdateName: (name: string) => void;
  onUpdateUnlock: (req: number) => void;
  onDelete: () => void;
  onReorderLevel: (levelId: string, dir: 'up' | 'down') => void;
  onDeleteLevel: (levelId: string) => void;
  onEditLevel: (levelId: string) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [nameVal, setNameVal] = useState(part.name);
  const [unlockVal, setUnlockVal] = useState(String(part.unlockRequirement));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const levels = sortedEntries(part.order);

  const handleSave = async () => {
    setSaving(true);
    const { updatePart } = await import('@/app/src/lib/firebase/admin');
    await updatePart(part.partId, {
      name: nameVal.trim() || part.name,
      unlockRequirement: Math.max(0, Number(unlockVal) || 0),
    });
    onUpdateName(nameVal.trim() || part.name);
    onUpdateUnlock(Math.max(0, Number(unlockVal) || 0));
    setSaving(false);
    setEditMode(false);
  };

  const handleDelete = async () => {
    const { deletePart } = await import('@/app/src/lib/firebase/admin');
    await deletePart(part.partId);
    onDelete();
  };

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(0,196,255,0.15)',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      {/* Part header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid rgba(0,196,255,0.08)',
          background: 'rgba(0,196,255,0.03)',
        }}
      >
        {editMode ? (
          <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              placeholder="Part name"
              style={{ ...INPUT_STYLE, flex: '1 1 140px', maxWidth: 260 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>Unlock after</span>
              <input
                type="number"
                value={unlockVal}
                onChange={(e) => setUnlockVal(e.target.value)}
                style={{ ...INPUT_STYLE, width: 60 }}
                min={0}
              />
              <span style={{ fontSize: 10, color: '#475569' }}>levels</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <NeonBtn color="#00ff88" onClick={handleSave} disabled={saving} small>
                {saving ? '...' : 'Save'}
              </NeonBtn>
              <NeonBtn color="#475569" onClick={() => { setEditMode(false); setNameVal(part.name); setUnlockVal(String(part.unlockRequirement)); }} small>
                Cancel
              </NeonBtn>
            </div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#00c4ff', letterSpacing: '0.06em' }}>
                {part.name}
              </span>
              <span style={{ fontSize: 10, color: '#334155', marginLeft: 10 }}>
                Unlock after {part.unlockRequirement} levels &nbsp;·&nbsp; {levels.length} level{levels.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <NeonBtn color="#fbbf24" small onClick={() => setEditMode(true)}>Edit</NeonBtn>
              {confirmDelete ? (
                <>
                  <NeonBtn color="#ef4444" small onClick={handleDelete}>Confirm Delete</NeonBtn>
                  <NeonBtn color="#475569" small onClick={() => setConfirmDelete(false)}>Cancel</NeonBtn>
                </>
              ) : (
                <NeonBtn color="#ef4444" small onClick={() => setConfirmDelete(true)}>Delete Part</NeonBtn>
              )}
            </div>
          </>
        )}
      </div>

      {/* Levels list */}
      <div style={{ padding: '12px 16px' }}>
        {levels.length === 0 ? (
          <p style={{ color: '#1e3a5f', fontSize: 11, margin: '4px 0 8px', fontStyle: 'italic' }}>
            No levels yet. Publish a level to this part from the editor.
          </p>
        ) : (
          levels.map((entry, idx) => (
            <LevelRow
              key={entry.id}
              entry={entry}
              isFirst={idx === 0}
              isLast={idx === levels.length - 1}
              onMoveUp={() => onReorderLevel(entry.id, 'up')}
              onMoveDown={() => onReorderLevel(entry.id, 'down')}
              onEdit={() => onEditLevel(entry.id)}
              onDelete={() => onDeleteLevel(entry.id)}
            />
          ))
        )}
        <div style={{ marginTop: 8 }}>
          <NeonBtn color="#00ff88" onClick={() => onEditLevel('')} small>
            + Add Level via Editor
          </NeonBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminLevelPartsPage() {
  const router = useRouter();
  const { role, loading } = useAuth();

  const [parts, setParts] = useState<LevelPart[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Create part modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUnlock, setNewUnlock] = useState('0');
  const [creating, setCreating] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (!loading && role !== 'admin') router.replace('/');
  }, [loading, role, router]);

  // Fetch all parts once on mount
  useEffect(() => {
    if (role !== 'admin') return;
    (async () => {
      const { getAllParts } = await import('@/app/src/lib/firebase/admin');
      const fetched = await getAllParts();
      setParts(fetched);
      setDataLoading(false);
    })();
  }, [role]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  // ── Create part ─────────────────────────────────────────────────────────────

  const handleCreatePart = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const { setPart } = await import('@/app/src/lib/firebase/admin');
    const created = await setPart(newName.trim(), Math.max(0, Number(newUnlock) || 0));
    setParts((prev) => [...prev, created]);
    setNewName('');
    setNewUnlock('0');
    setCreating(false);
    setShowCreate(false);
    showToast(`Part "${created.name}" created`);
  };

  // ── Part metadata update (local state only — Firebase called inside PartCard) ─

  const handleUpdatePartName = useCallback((partId: string, name: string) => {
    setParts((prev) =>
      prev.map((p) => p.partId === partId ? { ...p, name } : p),
    );
    showToast('Part updated');
  }, [showToast]);

  const handleUpdatePartUnlock = useCallback((partId: string, unlockRequirement: number) => {
    setParts((prev) =>
      prev.map((p) => p.partId === partId ? { ...p, unlockRequirement } : p),
    );
  }, []);

  const handleDeletePart = useCallback((partId: string, name: string) => {
    setParts((prev) => prev.filter((p) => p.partId !== partId));
    showToast(`Part "${name}" deleted`);
  }, [showToast]);

  // ── Level operations ────────────────────────────────────────────────────────

  const handleReorderLevel = useCallback(async (partId: string, levelId: string, dir: 'up' | 'down') => {
    // Compute new positions then update state + Firebase
    setParts((prev) => {
      const partIdx = prev.findIndex((p) => p.partId === partId);
      if (partIdx === -1) return prev;
      const part = prev[partIdx];
      const levels = sortedEntries(part.order);
      const idx = levels.findIndex((e) => e.id === levelId);
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= levels.length) return prev;

      const levelA = levels[idx];
      const levelB = levels[swapIdx];
      const posA = levelA.position ?? idx;
      const posB = levelB.position ?? swapIdx;

      // Persist concurrently (fire-and-forget)
      import('@/app/src/lib/firebase/admin').then(({ moveLevelsInPart }) => {
        moveLevelsInPart(partId, [
          { levelId: levelA.id, position: posB },
          { levelId: levelB.id, position: posA },
        ]).catch(console.error);
      });

      const newOrder = {
        ...part.order,
        [levelA.id]: { ...levelA, position: posB },
        [levelB.id]: { ...levelB, position: posA },
      };
      const newParts = [...prev];
      newParts[partIdx] = { ...part, order: newOrder };
      return newParts;
    });
  }, []);

  const handleDeleteLevel = useCallback(async (partId: string, levelId: string) => {
    // Optimistic update
    setParts((prev) => {
      const partIdx = prev.findIndex((p) => p.partId === partId);
      if (partIdx === -1) return prev;
      const part = prev[partIdx];
      const newOrder = { ...part.order };
      delete newOrder[levelId];
      const newParts = [...prev];
      newParts[partIdx] = { ...part, order: newOrder };
      return newParts;
    });

    const { deleteFirestoreLevel } = await import('@/app/src/lib/firebase/admin');
    await deleteFirestoreLevel(levelId, partId).catch(console.error);
    showToast('Level deleted');
  }, [showToast]);

  const handleEditLevel = useCallback((firestoreId: string) => {
    if (firestoreId) {
      router.push(`/editor?firestoreId=${firestoreId}`);
    } else {
      router.push('/editor');
    }
  }, [router]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading || role !== 'admin') {
    return (
      <main style={{ minHeight: '100dvh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em' }}>Loading...</span>
      </main>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#030712', color: '#e2e8f0', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: 'rgba(3,7,18,0.97)', borderBottom: '1px solid rgba(0,196,255,0.15)' }}>
        <button
          onClick={() => router.push('/admin')}
          style={{ background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer', letterSpacing: '0.06em' }}
        >
          ← Admin
        </button>
        <h1 style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00c4ff', textShadow: '0 0 10px rgba(0,196,255,0.5)' }}>
          Level Parts
        </h1>
        <NeonBtn color="#00ff88" onClick={() => setShowCreate(true)} small>
          + New Part
        </NeonBtn>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 800, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
        {dataLoading ? (
          <div style={{ textAlign: 'center', color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em', paddingTop: 60 }}>
            Loading...
          </div>
        ) : parts.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ color: '#1e3a5f', fontSize: 13 }}>No parts yet. Create one to get started.</p>
          </div>
        ) : (
          parts.map((part) => (
            <PartCard
              key={part.partId}
              part={part}
              onUpdateName={(name) => handleUpdatePartName(part.partId, name)}
              onUpdateUnlock={(req) => handleUpdatePartUnlock(part.partId, req)}
              onDelete={() => handleDeletePart(part.partId, part.name)}
              onReorderLevel={(levelId, dir) => handleReorderLevel(part.partId, levelId, dir)}
              onDeleteLevel={(levelId) => handleDeleteLevel(part.partId, levelId)}
              onEditLevel={handleEditLevel}
            />
          ))
        )}
      </div>

      {/* Create Part modal */}
      {showCreate && (
        <Modal title="New Part" onClose={() => setShowCreate(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#475569', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                Part Name
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Basics, Advanced..."
                style={INPUT_STYLE}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePart(); }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#475569', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                Unlock after (levels completed)
              </label>
              <input
                type="number"
                value={newUnlock}
                onChange={(e) => setNewUnlock(e.target.value)}
                style={{ ...INPUT_STYLE, width: 100 }}
                min={0}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <NeonBtn color="#475569" onClick={() => setShowCreate(false)}>Cancel</NeonBtn>
              <NeonBtn color="#00ff88" onClick={handleCreatePart} disabled={!newName.trim() || creating}>
                {creating ? 'Creating...' : 'Create'}
              </NeonBtn>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(6,13,26,0.96)', border: '1px solid rgba(0,196,255,0.4)', borderRadius: 10, padding: '10px 20px', fontSize: 13, color: '#00c4ff', zIndex: 200, boxShadow: '0 0 20px rgba(0,196,255,0.2)', pointerEvents: 'none' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
