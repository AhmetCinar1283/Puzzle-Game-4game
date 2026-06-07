'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/src/hooks/useAuth';
import type { LevelPart, LevelOrderEntry } from '@/app/src/lib/firebase/admin';
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from '@/app/editor/editorConfig';
import { useT } from '@/app/src/contexts/LanguageContext';

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
  onDesignMap,
}: {
  part: LevelPart;
  onUpdateName: (name: string) => void;
  onUpdateUnlock: (req: number) => void;
  onDelete: () => void;
  onReorderLevel: (levelId: string, dir: 'up' | 'down') => void;
  onDeleteLevel: (levelId: string) => void;
  onEditLevel: (levelId: string) => void;
  onDesignMap: () => void;
}) {
  const t = useT();
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
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <NeonBtn color="#00ff88" onClick={() => onEditLevel('')} small>
            + Add Level via Editor
          </NeonBtn>
          <NeonBtn color="#00c4ff" onClick={onDesignMap} small>
            {t('admin.design_map')}
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
  const t = useT();

  const [parts, setParts] = useState<LevelPart[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Map Designer state
  const [designerPart, setDesignerPart] = useState<LevelPart | null>(null);

  // Create part modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUnlock, setNewUnlock] = useState('0');
  const [creating, setCreating] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const handleSaveMapLayout = useCallback((
    partId: string,
    levelCoords: Record<string, { mapX: number; mapY: number }>,
    portalCoords: { portalX: number; portalY: number; portalStartX: number; portalStartY: number },
    theme: string
  ) => {
    setParts((prev) =>
      prev.map((p) => {
        if (p.partId !== partId) return p;

        const newOrder = { ...p.order };
        Object.entries(levelCoords).forEach(([levelId, c]) => {
          if (newOrder[levelId]) {
            newOrder[levelId] = {
              ...newOrder[levelId],
              mapX: c.mapX,
              mapY: c.mapY
            };
          }
        });

        return {
          ...p,
          order: newOrder,
          portalX: portalCoords.portalX,
          portalY: portalCoords.portalY,
          portalStartX: portalCoords.portalStartX,
          portalStartY: portalCoords.portalStartY,
          mapTheme: theme
        };
      })
    );
    showToast('Map layout updated successfully');
  }, [showToast]);

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
              onDesignMap={() => setDesignerPart(part)}
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

      {/* Map Designer Modal */}
      {designerPart && (
        <MapDesignerModal
          part={designerPart}
          onClose={() => setDesignerPart(null)}
          onSave={handleSaveMapLayout}
        />
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

// ─── Map Designer Modal ────────────────────────────────────────────────────────

interface Coords {
  x: number;
  y: number;
}

interface MapDesignerModalProps {
  part: LevelPart;
  onClose: () => void;
  onSave: (
    partId: string,
    levelCoords: Record<string, { mapX: number; mapY: number }>,
    portalCoords: { portalX: number; portalY: number; portalStartX: number; portalStartY: number },
    theme: string
  ) => void;
}

function MapDesignerModal({ part, onClose, onSave }: MapDesignerModalProps) {
  const t = useT();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mapTheme, setMapTheme] = useState<string>(part.mapTheme || 'cyber-grid');

  const sortedLevels = useMemo(() => {
    return Object.values(part.order).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [part.order]);

  // Local state for coordinates
  const [levelCoords, setLevelCoords] = useState<Record<string, Coords>>(() => {
    const coords: Record<string, Coords> = {};
    sortedLevels.forEach((lv, i) => {
      if (lv.mapX !== undefined && lv.mapY !== undefined) {
        coords[lv.id] = { x: lv.mapX, y: lv.mapY };
      } else {
        const count = sortedLevels.length;
        const ratio = count > 1 ? i / (count - 1) : 0.5;
        const y = Math.round(80 - ratio * 60); // Winding spline center
        const x = Math.round(50 + Math.sin(ratio * Math.PI * 3) * 32);
        coords[lv.id] = { x, y };
      }
    });
    return coords;
  });

  // Exit Portal state (Top portal)
  const [portalCoords, setPortalCoords] = useState<Coords>(() => {
    if (part.portalX !== undefined && part.portalY !== undefined) {
      return { x: part.portalX, y: part.portalY };
    }
    return { x: 50, y: 10 };
  });

  // Entry Portal state (Bottom portal)
  const [portalStartCoords, setPortalStartCoords] = useState<Coords>(() => {
    if (part.portalStartX !== undefined && part.portalStartY !== undefined) {
      return { x: part.portalStartX, y: part.portalStartY };
    }
    return { x: 50, y: 90 };
  });

  const [saving, setSaving] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const getThemeBackground = () => {
    switch (mapTheme) {
      case 'star-nebula':
        return {
          background: 'radial-gradient(circle at 50% 50%, #0c1530 0%, #020617 100%)',
          boxShadow: 'inset 0 0 100px rgba(99, 102, 241, 0.15)'
        };
      case 'cosmic-vortex':
        return {
          background: 'radial-gradient(circle at 50% 50%, #200c3b 0%, #06020f 100%)',
          boxShadow: 'inset 0 0 100px rgba(168, 85, 247, 0.15)'
        };
      case 'retro-matrix':
        return {
          background: '#000',
          backgroundImage: 'linear-gradient(to right, rgba(34, 197, 94, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(34, 197, 94, 0.05) 1px, transparent 1px)',
          backgroundSize: '25px 25px'
        };
      case 'neon-abyss':
        return {
          background: 'linear-gradient(180deg, #0d0614 0%, #020005 100%)',
          boxShadow: 'inset 0 0 100px rgba(236, 72, 153, 0.12)'
        };
      case 'cyber-grid':
      default:
        return {
          background: '#030712',
          backgroundImage: 'linear-gradient(to right, rgba(0, 196, 255, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 196, 255, 0.06) 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        };
    }
  };

  const getThemeColor = () => {
    if (mapTheme === 'retro-matrix') return '#22c55e';
    if (mapTheme === 'neon-abyss') return '#ec4899';
    if (mapTheme === 'cosmic-vortex') return '#a855f7';
    if (mapTheme === 'star-nebula') return '#6366f1';
    return '#00c4ff';
  };

  const generatePreset = (type: 'snake' | 'spiral' | 'circle') => {
    const count = sortedLevels.length;
    const newCoords: Record<string, Coords> = {};

    if (type === 'snake') {
      sortedLevels.forEach((lv, i) => {
        const ratio = count > 1 ? i / (count - 1) : 0.5;
        const y = Math.round(80 - ratio * 60);
        const x = Math.round(50 + Math.sin(ratio * Math.PI * 3) * 32);
        newCoords[lv.id] = { x, y };
      });
      setPortalCoords({ x: 50, y: 10 });
      setPortalStartCoords({ x: 50, y: 90 });
    } else if (type === 'spiral') {
      sortedLevels.forEach((lv, i) => {
        const ratio = count > 0 ? i / count : 0.5;
        const angle = ratio * Math.PI * 4;
        const radius = 6 + ratio * 32;
        const x = Math.round(50 + Math.cos(angle) * radius);
        const y = Math.round(55 + Math.sin(angle) * radius);
        newCoords[lv.id] = { x, y };
      });
      setPortalStartCoords({ x: 50, y: 55 }); // Center spiral entry
      const portalAngle = 1.05 * Math.PI * 4;
      const portalRadius = 6 + 1.05 * 32;
      setPortalCoords({
        x: Math.max(5, Math.min(95, Math.round(50 + Math.cos(portalAngle) * portalRadius))),
        y: Math.max(5, Math.min(95, Math.round(55 + Math.sin(portalAngle) * portalRadius)))
      });
    } else if (type === 'circle') {
      sortedLevels.forEach((lv, i) => {
        const angle = (i / (count + 1)) * Math.PI * 1.6 - Math.PI * 0.8;
        const x = Math.round(50 + Math.cos(angle) * 32);
        const y = Math.round(50 + Math.sin(angle) * 32);
        newCoords[lv.id] = { x, y };
      });
      setPortalStartCoords({ x: 50, y: 90 });
      setPortalCoords({ x: 50, y: 10 });
    }

    setLevelCoords(newCoords);
  };

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    setActiveDragId(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeDragId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(2, Math.min(98, Math.round(((e.clientY - rect.top) / rect.height) * 100)));

    if (activeDragId === 'portal') {
      setPortalCoords({ x, y });
    } else if (activeDragId === 'portalStart') {
      setPortalStartCoords({ x, y });
    } else {
      setLevelCoords(prev => ({ ...prev, [activeDragId]: { x, y } }));
    }
  };

  const handlePointerUp = (id: string, e: React.PointerEvent) => {
    if (activeDragId) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setActiveDragId(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { updatePartMapLayout } = await import('@/app/src/lib/firebase/admin');
      
      const levelCoordsSave: Record<string, { mapX: number; mapY: number }> = {};
      Object.entries(levelCoords).forEach(([levelId, c]) => {
        levelCoordsSave[levelId] = { mapX: c.x, mapY: c.y };
      });

      await updatePartMapLayout(
        part.partId,
        levelCoordsSave,
        {
          portalX: portalCoords.x,
          portalY: portalCoords.y,
          portalStartX: portalStartCoords.x,
          portalStartY: portalStartCoords.y
        },
        mapTheme
      );
      
      onSave(
        part.partId,
        levelCoordsSave,
        {
          portalX: portalCoords.x,
          portalY: portalCoords.y,
          portalStartX: portalStartCoords.x,
          portalStartY: portalStartCoords.y
        },
        mapTheme
      );
      onClose();
    } catch (err) {
      console.error('[MapDesigner]', err);
    } finally {
      setSaving(false);
    }
  };

  // Organic B-Spline smooth winding path calculation
  const svgPathData = useMemo(() => {
    const points: Array<Coords> = [];
    points.push({ x: portalStartCoords.x, y: portalStartCoords.y });
    sortedLevels.forEach((lv) => {
      const c = levelCoords[lv.id];
      if (c) points.push({ x: c.x, y: c.y });
    });
    points.push({ x: portalCoords.x, y: portalCoords.y });

    if (points.length < 2) return '';
    let path = `M ${points[0].x}% ${points[0].y}%`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      path += ` Q ${p0.x}% ${p0.y}%, ${mx}% ${my}%`;
    }
    path += ` L ${points[points.length - 1].x}% ${points[points.length - 1].y}%`;
    return path;
  }, [sortedLevels, levelCoords, portalCoords, portalStartCoords]);

  const activeThemeColor = getThemeColor();

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(3,7,18,0.92)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          background: '#070a13',
          border: `1px solid ${activeThemeColor}40`,
          borderRadius: 16,
          width: '100%',
          maxWidth: 960,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: `0 0 50px ${activeThemeColor}15`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {t('admin.designer_title')} <span style={{ color: activeThemeColor }}>· {part.name}</span>
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflowY: 'auto', flexWrap: 'wrap' }}>
          
          <div style={{ width: '100%', maxWidth: 300, padding: 24, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box', overflowY: 'auto' }}>
            
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 900, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                {t('admin.designer_theme') || 'Harita Teması'}
              </label>
              <select
                value={mapTheme}
                onChange={(e) => setMapTheme(e.target.value)}
                style={{
                  width: '100%', background: '#0a0f1d', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 12, outline: 'none'
                }}
              >
                <option value="cyber-grid">{t('admin.designer_theme_cyber') || 'Siber Izgara (Cyber Grid)'}</option>
                <option value="star-nebula">{t('admin.designer_theme_star') || 'Yıldız Bulutu (Star Nebula)'}</option>
                <option value="cosmic-vortex">{t('admin.designer_theme_cosmic') || 'Kozmik Girdap (Cosmic Vortex)'}</option>
                <option value="retro-matrix">{t('admin.designer_theme_retro') || 'Retro Matrix'}</option>
                <option value="neon-abyss">{t('admin.designer_theme_abyss') || 'Neon Uçurum (Neon Abyss)'}</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 900, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                {t('admin.designer_preset') || 'Hazır Şablon Üret'}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => generatePreset('snake')}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 11, cursor: 'pointer', textAlign: 'left', fontWeight: 600, transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                >
                  📈 {t('admin.designer_preset_snake') || 'Kıvrımlı Yol (Snake)'}
                </button>
                <button
                  onClick={() => generatePreset('spiral')}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 11, cursor: 'pointer', textAlign: 'left', fontWeight: 600, transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                >
                  🌀 {t('admin.designer_preset_spiral') || 'Spiral (Dışa Doğru)'}
                </button>
                <button
                  onClick={() => generatePreset('circle')}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 11, cursor: 'pointer', textAlign: 'left', fontWeight: 600, transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                >
                  ◯ {t('admin.designer_preset_circle') || 'Çember Düzeni'}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 'auto', background: `${activeThemeColor}06`, border: `1px solid ${activeThemeColor}15`, borderRadius: 8, padding: 12 }}>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                💡 <strong>Nasıl tasarlanır:</strong> Seviye düğmelerini ve portalları sürükleyip yerleştirin. 🌀 (turuncu kenarlı) Çıkış, 🟢 (yeşil kenarlı) Giriş Portalidir.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: '10px 16px', background: saving ? 'rgba(0,255,136,0.3)' : '#00ff88', border: 'none', color: '#030712', fontWeight: 800, borderRadius: 8, fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', boxShadow: saving ? 'none' : '0 0 16px rgba(0,255,136,0.3)' }}
              >
                {saving ? '...' : (t('admin.designer_save') || 'Düzeni ve Temayı Kaydet')}
              </button>
              <button
                onClick={onClose} disabled={saving}
                style={{ padding: '10px 14px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
              >
                {t('admin.designer_cancel') || 'İptal'}
              </button>
            </div>

          </div>

          <div style={{ flex: 1, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#03050a', boxSizing: 'border-box' }}>
            <div
              ref={canvasRef}
              style={{
                width: '100%',
                maxWidth: 420,
                aspectRatio: '1 / 1.5',
                position: 'relative',
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.06)',
                overflow: 'hidden',
                boxSizing: 'border-box',
                ...getThemeBackground(),
                transition: 'all 0.3s ease'
              }}
            >
              {svgPathData && (
                <svg
                  style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1
                  }}
                >
                  {/* Thick glowing organic rope backing */}
                  <path
                    d={svgPathData}
                    fill="none"
                    stroke={activeThemeColor}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.18, filter: 'blur(5px)' }}
                  />
                  <path
                    d={svgPathData}
                    fill="none"
                    stroke={activeThemeColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.55 }}
                  />
                </svg>
              )}

              {/* Entry Portal (Green border, bottom portal) */}
              <div
                onPointerDown={(e) => handlePointerDown('portalStart', e)}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handlePointerUp('portalStart', e)}
                style={{
                  position: 'absolute',
                  left: `${portalStartCoords.x}%`,
                  top: `${portalStartCoords.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #10b981 0%, #064e3b 100%)',
                  border: '2px solid #34d399',
                  boxShadow: '0 0 15px rgba(16, 185, 129, 0.6)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 900,
                  cursor: 'move',
                  zIndex: 10,
                  userSelect: 'none',
                  touchAction: 'none'
                }}
                title="Entry Portal"
              >
                🌀
              </div>

              {/* Exit Portal (Yellow border, top portal) */}
              <div
                onPointerDown={(e) => handlePointerDown('portal', e)}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handlePointerUp('portal', e)}
                style={{
                  position: 'absolute',
                  left: `${portalCoords.x}%`,
                  top: `${portalCoords.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #f59e0b 0%, #b45309 100%)',
                  border: '2px solid #ffd700',
                  boxShadow: '0 0 15px rgba(245, 158, 11, 0.6)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 900,
                  cursor: 'move',
                  zIndex: 10,
                  userSelect: 'none',
                  touchAction: 'none'
                }}
                title="Exit Portal"
              >
                🌀
              </div>

              {/* Level Nodes */}
              {sortedLevels.map((lv, idx) => {
                const coords = levelCoords[lv.id] || { x: 50, y: 50 };
                return (
                  <div
                    key={lv.id}
                    onPointerDown={(e) => handlePointerDown(lv.id, e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={(e) => handlePointerUp(lv.id, e)}
                    style={{
                      position: 'absolute',
                      left: `${coords.x}%`,
                      top: `${coords.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#0a0f1d',
                      border: `2px solid ${activeThemeColor}`,
                      boxShadow: `0 0 8px ${activeThemeColor}40`,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'move',
                      zIndex: 5,
                      userSelect: 'none',
                      touchAction: 'none'
                    }}
                  >
                    {idx + 1}
                  </div>
                );
              })}

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

