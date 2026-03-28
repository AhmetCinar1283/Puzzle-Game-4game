'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import type { CellType, EdgeBehavior, MovementMode, LevelData } from '@/app/src/games/types';
import type { StoredLevel } from '@/app/src/lib/db';
import GameShell from '@/app/src/games/components/GameShell';
import GameCell from '@/app/src/games/components/GameCell';

// ─── Types ─────────────────────────────────────────────────────────────────

type ToolType = CellType | 'place_obj1' | 'place_obj2' | 'erase';

interface ObjConfig {
  id: number;
  row: number | null;
  col: number | null;
  mode: MovementMode;
  lockOnTarget: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CELL_TYPES: CellType[] = [
  'empty', 'obstacle', 'forbidden', 'target_1', 'target_2', 'direction_toggle',
];

const CELL_LABEL: Record<CellType | 'erase', string> = {
  empty: 'Empty', obstacle: 'Obstacle', forbidden: 'Forbidden',
  target_1: 'Target 1', target_2: 'Target 2', direction_toggle: 'Toggle', erase: 'Erase',
};

const CELL_ICON: Record<CellType | 'erase', string> = {
  empty: '▫', obstacle: '■', forbidden: '✕',
  target_1: '◎', target_2: '◎', direction_toggle: '⇄', erase: '⌫',
};

const CELL_COLOR: Record<CellType | 'erase', string> = {
  empty: '#475569', obstacle: '#94a3b8', forbidden: '#ef4444',
  target_1: '#00ff88', target_2: '#00c4ff', direction_toggle: '#ffd700', erase: '#64748b',
};

const EDGE_OPTIONS: EdgeBehavior[] = ['wall', 'portal', 'lava'];
const EDGE_LABEL: Record<EdgeBehavior, string> = { wall: 'Wall', portal: 'Portal', lava: 'Lava' };
const EDGE_COLOR: Record<EdgeBehavior, string> = { wall: '#475569', portal: '#9333ea', lava: '#ef4444' };

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeGrid(w: number, h: number): CellType[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => 'empty' as CellType));
}

function resizeGrid(old: CellType[][], w: number, h: number): CellType[][] {
  return Array.from({ length: h }, (_, r) =>
    Array.from({ length: w }, (_, c) => old[r]?.[c] ?? 'empty'),
  );
}


// ─── Small UI pieces ────────────────────────────────────────────────────────

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#1e3a5f', borderBottom: '1px solid rgba(30,58,95,0.4)', paddingBottom: 5, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155', display: 'block', marginBottom: 5 }}>{children}</span>;
}

const iStyle: React.CSSProperties = { background: '#060d1a', border: '1px solid rgba(30,58,95,0.6)', color: '#94a3b8', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' };

function NBtn({ children, onClick, active, color = '#94a3b8', style, disabled }: { children: React.ReactNode; onClick?: () => void; active?: boolean; color?: string; style?: React.CSSProperties; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: '5px 9px', fontSize: 11, fontWeight: 600, letterSpacing: '0.03em', border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`, background: active ? `${color}1a` : 'rgba(255,255,255,0.02)', color: active ? color : '#475569', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: active ? `0 0 8px ${color}28` : 'none', transition: 'all 0.12s', opacity: disabled ? 0.45 : 1, ...style }}>
      {children}
    </button>
  );
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

function EditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id') ? Number(searchParams.get('id')) : null;

  // Level data
  const [levelName, setLevelName] = useState('My Level');
  const [width, setWidth] = useState(5);
  const [height, setHeight] = useState(5);
  const [pendingW, setPendingW] = useState(5);
  const [pendingH, setPendingH] = useState(5);
  const [trailCollision, setTrailCollision] = useState(false);
  const [edges, setEdges] = useState<Record<'top' | 'bottom' | 'left' | 'right', EdgeBehavior>>({ top: 'wall', bottom: 'wall', left: 'wall', right: 'wall' });
  const [grid, setGrid] = useState<CellType[][]>(() => makeGrid(5, 5));
  const [objects, setObjects] = useState<ObjConfig[]>([
    { id: 1, row: null, col: null, mode: 'normal', lockOnTarget: true },
    { id: 2, row: null, col: null, mode: 'normal', lockOnTarget: true },
  ]);

  // Tool + painting
  const [activeTool, setActiveTool] = useState<ToolType>('obstacle');
  const isPainting = useRef(false);
  const paintMode = useRef<'paint' | 'erase'>('paint'); // determined on mousedown

  // Saved levels list
  const [savedLevels, setSavedLevels] = useState<(StoredLevel & { id: number })[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(true);

  // UI states
  const [testLevel, setTestLevel] = useState<LevelData | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savePosition, setSavePosition] = useState('');
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  // Load saved levels from Dexie
  const reloadLevels = useCallback(async () => {
    const { getOrderedLevels } = await import('@/app/src/lib/db');
    const levels = await getOrderedLevels();
    setSavedLevels(levels as (StoredLevel & { id: number })[]);
    setLevelsLoading(false);
  }, []);

  // Load a specific level for editing (from URL param)
  const loadForEdit = useCallback(async (id: number) => {
    const { getDB } = await import('@/app/src/lib/db');
    const db = getDB();
    const stored = await db.levels.get(id);
    if (!stored) return;
    setLevelName(stored.name);
    setWidth(stored.width);
    setHeight(stored.height);
    setPendingW(stored.width);
    setPendingH(stored.height);
    setEdges(stored.edges as typeof edges);
    setGrid(stored.grid as CellType[][]);
    setTrailCollision(!!stored.trailCollision);
    const objs: ObjConfig[] = [
      { id: 1, row: null, col: null, mode: 'normal', lockOnTarget: true },
      { id: 2, row: null, col: null, mode: 'normal', lockOnTarget: true },
    ];
    stored.initialObjects.forEach((obj) => {
      const idx = objs.findIndex((o) => o.id === obj.id);
      if (idx >= 0) objs[idx] = { id: obj.id, row: obj.position.row, col: obj.position.col, mode: obj.mode, lockOnTarget: obj.lockOnTarget };
    });
    setObjects(objs);
  }, []);

  useEffect(() => {
    reloadLevels();
  }, [reloadLevels]);

  useEffect(() => {
    if (editId !== null) loadForEdit(editId);
  }, [editId, loadForEdit]);

  // ── Resize grid ─────────────────────────────────────────────────────────
  const applyResize = useCallback(() => {
    const newW = Math.max(3, Math.min(16, pendingW));
    const newH = Math.max(3, Math.min(16, pendingH));
    setWidth(newW); setHeight(newH);
    setGrid((g) => resizeGrid(g, newW, newH));
    setObjects((os) => os.map((o) => ({ ...o, row: o.row !== null && o.row < newH ? o.row : null, col: o.col !== null && o.col < newW ? o.col : null })));
  }, [pendingW, pendingH]);

  // ── Paint cell ──────────────────────────────────────────────────────────
  const paintCell = useCallback((r: number, c: number, isDrag: boolean) => {
    if (activeTool === 'place_obj1') { setObjects((os) => os.map((o) => o.id === 1 ? { ...o, row: r, col: c } : o)); return; }
    if (activeTool === 'place_obj2') { setObjects((os) => os.map((o) => o.id === 2 ? { ...o, row: r, col: c } : o)); return; }

    const cellType: CellType = activeTool === 'erase' ? 'empty' : activeTool;

    setGrid((g) => {
      const next = g.map((row) => [...row]);
      const current = next[r][c];

      if (isDrag) {
        // In drag mode: follow the initial paintMode (paint or erase)
        if (paintMode.current === 'erase') { next[r][c] = 'empty'; return next; }
      } else {
        // Single click: toggle off if same type
        if (activeTool !== 'erase' && current === cellType) {
          paintMode.current = 'erase';
          next[r][c] = 'empty';
          return next;
        }
        paintMode.current = 'paint';
      }

      // Only one target_1/target_2 allowed
      if (cellType === 'target_1' || cellType === 'target_2') {
        for (let row = 0; row < next.length; row++)
          for (let col = 0; col < next[row].length; col++)
            if (next[row][col] === cellType) next[row][col] = 'empty';
      }
      next[r][c] = cellType;
      return next;
    });
  }, [activeTool]);

  // ── Generate LevelData ──────────────────────────────────────────────────
  const generateLevelData = useCallback((): { level: LevelData | null; error: string | null } => {
    const targets: { objectId: number; position: { row: number; col: number } }[] = [];
    for (let r = 0; r < height; r++)
      for (let c = 0; c < width; c++) {
        if (grid[r][c] === 'target_1') targets.push({ objectId: 1, position: { row: r, col: c } });
        if (grid[r][c] === 'target_2') targets.push({ objectId: 2, position: { row: r, col: c } });
      }
    const validObjs = objects.filter((o) => o.row !== null && o.col !== null);
    if (validObjs.length < 2) return { level: null, error: 'Place both objects on the grid first.' };
    const level: LevelData = {
      id: editId ?? 0,
      name: levelName || 'Unnamed Level',
      width, height, edges, grid,
      initialObjects: validObjs.map((o) => ({ id: o.id, position: { row: o.row!, col: o.col! }, mode: o.mode, lockOnTarget: o.lockOnTarget })),
      targets,
      ...(trailCollision ? { trailCollision: true } : {}),
    };
    return { level, error: null };
  }, [editId, levelName, width, height, edges, grid, objects, trailCollision]);

  // ── Save ──────────────────────────────────────────────────────────────
  const doSave = useCallback(async (posInput?: string) => {
    const { level, error } = generateLevelData();
    if (error || !level) { setTestError(error); return; }

    const payload: Omit<StoredLevel, 'id' | 'createdAt' | 'updatedAt'> = {
      name: level.name, width: level.width, height: level.height, edges: level.edges,
      grid: level.grid, initialObjects: level.initialObjects, targets: level.targets,
      trailCollision: level.trailCollision,
    };

    if (editId !== null) {
      // Updating existing
      const { updateStoredLevel } = await import('@/app/src/lib/db');
      await updateStoredLevel(editId, payload);
      setSaveSuccess('Saved!');
    } else {
      // New level — insert at position
      const { saveLevelAtPosition, getOrderedLevels } = await import('@/app/src/lib/db');
      let pos: number | undefined;
      if (posInput !== undefined && posInput.trim() !== '') {
        // User entered 1-based position → convert to 0-based index
        const n = parseInt(posInput, 10);
        if (!isNaN(n) && n >= 1) pos = n - 1;
      }
      const newId = await saveLevelAtPosition(payload, pos);
      const levels = await getOrderedLevels();
      setSavedLevels(levels as (StoredLevel & { id: number })[]);
      // Navigate to edit mode for the new level
      router.replace(`/editor?id=${newId}`);
      setSaveSuccess('Saved!');
    }

    await reloadLevels();
    setSaveSuccess('Saved!');
    setTimeout(() => setSaveSuccess(''), 2000);
    setSaveDialogOpen(false);
    setSavePosition('');
  }, [editId, generateLevelData, reloadLevels, router]);

  const handleSaveClick = useCallback(() => {
    if (editId !== null) {
      doSave();
    } else {
      setSaveDialogOpen(true);
    }
  }, [editId, doSave]);

  // ── Paste JSON ──────────────────────────────────────────────────────────
  const handlePaste = useCallback(() => {
    setPasteError('');
    try {
      const parsed = JSON.parse(pasteText) as Partial<LevelData>;
      if (!parsed.grid || !parsed.width || !parsed.height) throw new Error('Invalid format');
      setLevelName(parsed.name ?? 'Pasted Level');
      setWidth(parsed.width);
      setHeight(parsed.height);
      setPendingW(parsed.width);
      setPendingH(parsed.height);
      if (parsed.edges) setEdges(parsed.edges as typeof edges);
      setGrid(parsed.grid as CellType[][]);
      setTrailCollision(!!parsed.trailCollision);
      const objs: ObjConfig[] = [
        { id: 1, row: null, col: null, mode: 'normal', lockOnTarget: true },
        { id: 2, row: null, col: null, mode: 'normal', lockOnTarget: true },
      ];
      (parsed.initialObjects ?? []).forEach((obj) => {
        const idx = objs.findIndex((o) => o.id === obj.id);
        if (idx >= 0) objs[idx] = { id: obj.id, row: obj.position.row, col: obj.position.col, mode: obj.mode, lockOnTarget: obj.lockOnTarget };
      });
      setObjects(objs);
      setPasteDialogOpen(false);
      setPasteText('');
    } catch {
      setPasteError('Invalid JSON. Make sure it matches LevelData format.');
    }
  }, [pasteText]);

  // ── Load saved level into editor ────────────────────────────────────────
  const handleLoadLevel = useCallback((stored: StoredLevel & { id: number }) => {
    router.push(`/editor?id=${stored.id}`);
  }, [router]);

  // ── New level ───────────────────────────────────────────────────────────
  const handleNewLevel = useCallback(() => {
    router.push('/editor');
    setLevelName('My Level');
    setWidth(5); setHeight(5); setPendingW(5); setPendingH(5);
    setEdges({ top: 'wall', bottom: 'wall', left: 'wall', right: 'wall' });
    setGrid(makeGrid(5, 5));
    setTrailCollision(false);
    setObjects([
      { id: 1, row: null, col: null, mode: 'normal', lockOnTarget: true },
      { id: 2, row: null, col: null, mode: 'normal', lockOnTarget: true },
    ]);
  }, [router]);

  // ── Test ─────────────────────────────────────────────────────────────
  const handleTest = useCallback(() => {
    const { level, error } = generateLevelData();
    if (error || !level) { setTestError(error); return; }
    setTestError(null);
    setTestLevel(level);
  }, [generateLevelData]);

  // ── Copy JSON ─────────────────────────────────────────────────────────
  const jsonString = (() => {
    const { level } = generateLevelData();
    return level ? JSON.stringify(level, null, 2) : '// Place both objects to generate JSON';
  })();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [jsonString]);

  // ── Cell size ─────────────────────────────────────────────────────────
  const cellSize = Math.min(58, Math.floor(480 / Math.max(width, height)));

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#030712', color: '#e2e8f0', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px', background: 'rgba(3,7,18,0.97)', borderBottom: '1px solid rgba(0,196,255,0.15)' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer', letterSpacing: '0.06em' }}>← Menu</button>
        <h1 style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00c4ff', textShadow: '0 0 10px rgba(0,196,255,0.5)' }}>
          Level Editor {editId !== null ? <span style={{ color: '#1e3a5f', fontWeight: 400 }}>· editing #{editId}</span> : '· new'}
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <NBtn onClick={() => setPasteDialogOpen(true)} color="#94a3b8" style={{ fontSize: 11 }}>Paste JSON</NBtn>
          <NBtn onClick={handleSaveClick} color="#00ff88" active style={{ padding: '5px 16px' }}>
            {saveSuccess || (editId !== null ? 'Update' : 'Save')}
          </NBtn>
        </div>
      </div>

      {/* Body: three columns */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left: Saved Levels ── */}
        <div style={{ width: 170, flexShrink: 0, borderRight: '1px solid rgba(30,58,95,0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flexShrink: 0, padding: '10px 12px 6px', borderBottom: '1px solid rgba(30,58,95,0.3)' }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#1e3a5f' }}>Saved Levels</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            {levelsLoading ? (
              <span style={{ fontSize: 11, color: '#1e3a5f' }}>Loading...</span>
            ) : savedLevels.length === 0 ? (
              <span style={{ fontSize: 11, color: '#1e3a5f', lineHeight: 1.5, display: 'block', padding: '8px 4px' }}>No saved levels yet. Click Save to store your first level.</span>
            ) : (
              savedLevels.map((lv, idx) => (
                <button
                  key={lv.id}
                  onClick={() => handleLoadLevel(lv)}
                  style={{
                    width: '100%', marginBottom: 4, padding: '7px 10px', textAlign: 'left',
                    background: editId === lv.id ? 'rgba(0,196,255,0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${editId === lv.id ? 'rgba(0,196,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    color: editId === lv.id ? '#00c4ff' : '#64748b',
                    borderRadius: 6, cursor: 'pointer', fontSize: 12,
                  }}
                >
                  <span style={{ fontSize: 9, color: '#1e3a5f', display: 'block', marginBottom: 2 }}>#{idx + 1}</span>
                  {lv.name}
                  <span style={{ fontSize: 9, color: '#1e3a5f', display: 'block', marginTop: 1 }}>{lv.width}×{lv.height}</span>
                </button>
              ))
            )}
          </div>
          <div style={{ flexShrink: 0, padding: '8px', borderTop: '1px solid rgba(30,58,95,0.3)' }}>
            <button onClick={handleNewLevel} style={{ width: '100%', padding: '7px', fontSize: 12, background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88', borderRadius: 7, cursor: 'pointer', letterSpacing: '0.04em' }}>
              + New Level
            </button>
          </div>
        </div>

        {/* ── Center: Tool palette + Grid ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Tool palette */}
          <div style={{ width: 100, flexShrink: 0, borderRight: '1px solid rgba(30,58,95,0.3)', overflowY: 'auto', padding: '10px 6px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1e3a5f', marginBottom: 8 }}>Cells</div>
            {([...CELL_TYPES, 'erase'] as (CellType | 'erase')[]).map((t) => (
              <button key={t} onClick={() => setActiveTool(t as ToolType)} style={{ width: '100%', marginBottom: 3, padding: '6px 6px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: activeTool === t ? 700 : 400, border: `1px solid ${activeTool === t ? CELL_COLOR[t] : 'rgba(255,255,255,0.06)'}`, background: activeTool === t ? `${CELL_COLOR[t]}18` : 'rgba(255,255,255,0.01)', color: activeTool === t ? CELL_COLOR[t] : '#475569', borderRadius: 5, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                <span style={{ fontSize: 13, lineHeight: 1 }}>{CELL_ICON[t]}</span>
                <span style={{ fontSize: 10 }}>{CELL_LABEL[t]}</span>
              </button>
            ))}

            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1e3a5f', marginBottom: 8, marginTop: 14 }}>Objects</div>
            {[1, 2].map((id) => {
              const tool = `place_obj${id}` as ToolType;
              const color = id === 1 ? '#00ff88' : '#00c4ff';
              const obj = objects.find((o) => o.id === id)!;
              return (
                <button key={id} onClick={() => setActiveTool(tool)} style={{ width: '100%', marginBottom: 3, padding: '6px 6px', display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, fontWeight: activeTool === tool ? 700 : 400, border: `1px solid ${activeTool === tool ? color : 'rgba(255,255,255,0.06)'}`, background: activeTool === tool ? `${color}18` : 'rgba(255,255,255,0.01)', color: activeTool === tool ? color : '#475569', borderRadius: 5, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                  <span>● P{id}</span>
                  {obj.row !== null && <span style={{ fontSize: 9, opacity: 0.6 }}>({obj.row},{obj.col})</span>}
                </button>
              );
            })}
          </div>

          {/* Grid area — fixed center, no scroll */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <EdgeInd behavior={edges.top} axis="h" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <EdgeInd behavior={edges.left} axis="v" />
                {/* Grid */}
                <div
                  style={{ border: `3px solid transparent`, borderTopColor: EDGE_COLOR[edges.top], borderBottomColor: EDGE_COLOR[edges.bottom], borderLeftColor: EDGE_COLOR[edges.left], borderRightColor: EDGE_COLOR[edges.right], borderRadius: 6, overflow: 'hidden', background: '#060d1a', cursor: 'crosshair', userSelect: 'none', boxShadow: '0 0 40px rgba(0,0,0,0.7)' }}
                  onMouseLeave={() => { isPainting.current = false; }}
                >
                  {grid.map((row, r) => (
                    <div key={r} style={{ display: 'flex' }}>
                      {row.map((cell, c) => {
                        const isObj1 = objects[0].row === r && objects[0].col === c;
                        const isObj2 = objects[1].row === r && objects[1].col === c;
                        return (
                          <div key={c} style={{ position: 'relative' }}
                            onMouseDown={(e) => { e.preventDefault(); isPainting.current = true; paintCell(r, c, false); }}
                            onMouseEnter={() => { if (isPainting.current) paintCell(r, c, true); }}
                            onMouseUp={() => { isPainting.current = false; }}
                          >
                            <GameCell cellType={cell} cellSize={cellSize} />
                            {isObj1 && <ObjDot color="#00ff88" size={cellSize} label="1" />}
                            {isObj2 && <ObjDot color="#00c4ff" size={cellSize} label="2" />}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <EdgeInd behavior={edges.right} axis="v" />
              </div>
              <EdgeInd behavior={edges.bottom} axis="h" />
              <p style={{ fontSize: 9, color: '#1e3a5f', margin: 0, letterSpacing: '0.08em' }}>Click to paint · Click same cell = clear · Drag to fill</p>
            </div>
          </div>
        </div>

        {/* ── Right: Settings ── */}
        <div style={{ width: 270, flexShrink: 0, borderLeft: '1px solid rgba(30,58,95,0.4)', overflowY: 'auto', padding: '12px 14px' }}>

          <Sec title="Level Info">
            <Lbl>Name</Lbl>
            <input value={levelName} onChange={(e) => setLevelName(e.target.value)} style={{ ...iStyle, width: '100%', marginBottom: 0 }} />
          </Sec>

          <Sec title="Grid Size">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div><Lbl>W</Lbl><input type="number" min={3} max={16} value={pendingW} onChange={(e) => setPendingW(Number(e.target.value))} style={{ ...iStyle, width: 50 }} /></div>
              <div><Lbl>H</Lbl><input type="number" min={3} max={16} value={pendingH} onChange={(e) => setPendingH(Number(e.target.value))} style={{ ...iStyle, width: 50 }} /></div>
              <div style={{ paddingTop: 16 }}><NBtn onClick={applyResize} color="#00c4ff">Apply</NBtn></div>
            </div>
          </Sec>

          <Sec title="Edges">
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
              <div key={side} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 11, color: '#475569', textTransform: 'capitalize', width: 42 }}>{side}</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {EDGE_OPTIONS.map((opt) => (
                    <NBtn key={opt} onClick={() => setEdges((e) => ({ ...e, [side]: opt }))} active={edges[side] === opt} color={EDGE_COLOR[opt]} style={{ padding: '3px 7px', fontSize: 10 }}>
                      {EDGE_LABEL[opt]}
                    </NBtn>
                  ))}
                </div>
              </div>
            ))}
          </Sec>

          <Sec title="Options">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={trailCollision} onChange={(e) => setTrailCollision(e.target.checked)} style={{ accentColor: '#00c4ff', width: 13, height: 13 }} />
              <span style={{ fontSize: 12, color: trailCollision ? '#00c4ff' : '#475569' }}>Trail Collision</span>
            </label>
          </Sec>

          {objects.map((obj) => {
            const color = obj.id === 1 ? '#00ff88' : '#00c4ff';
            return (
              <Sec key={obj.id} title={`Object ${obj.id}`}>
                <div style={{ marginBottom: 8 }}>
                  <Lbl>Position</Lbl>
                  <span style={{ fontSize: 12, color: obj.row !== null ? color : '#334155' }}>
                    {obj.row !== null ? `(${obj.row}, ${obj.col})` : 'Not placed'}
                  </span>
                  {obj.row !== null && (
                    <button onClick={() => setObjects((os) => os.map((o) => o.id === obj.id ? { ...o, row: null, col: null } : o))} style={{ marginLeft: 8, fontSize: 10, background: 'none', border: 'none', color: '#334155', cursor: 'pointer' }}>✕</button>
                  )}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Lbl>Mode</Lbl>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {(['normal', 'reversed'] as MovementMode[]).map((m) => (
                      <NBtn key={m} onClick={() => setObjects((os) => os.map((o) => o.id === obj.id ? { ...o, mode: m } : o))} active={obj.mode === m} color={color} style={{ padding: '3px 8px', fontSize: 10 }}>
                        {m === 'normal' ? '↻ Norm' : '↺ Rev'}
                      </NBtn>
                    ))}
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                  <input type="checkbox" checked={obj.lockOnTarget} onChange={(e) => setObjects((os) => os.map((o) => o.id === obj.id ? { ...o, lockOnTarget: e.target.checked } : o))} style={{ accentColor: color, width: 12, height: 12 }} />
                  <span style={{ fontSize: 11, color: '#475569' }}>Lock on target</span>
                </label>
              </Sec>
            );
          })}

          <Sec title="Actions">
            {testError && <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{testError}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <button onClick={handleTest} style={{ padding: '9px', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.35)', color: '#00ff88', borderRadius: 8, cursor: 'pointer' }}>▶ Test Level</button>
              <button onClick={handleCopy} style={{ padding: '9px', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: copied ? 'rgba(0,196,255,0.1)' : 'rgba(0,196,255,0.04)', border: `1px solid ${copied ? 'rgba(0,196,255,0.5)' : 'rgba(0,196,255,0.25)'}`, color: '#00c4ff', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }}>
                {copied ? '✓ Copied!' : '📋 Copy JSON'}
              </button>
            </div>
          </Sec>

          <Sec title="JSON Preview">
            <textarea readOnly value={jsonString} style={{ width: '100%', height: 160, background: '#060d1a', border: '1px solid rgba(30,58,95,0.4)', color: '#334155', fontFamily: 'monospace', fontSize: 9, borderRadius: 6, padding: 8, resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }} />
          </Sec>
        </div>
      </div>

      {/* ── Save position dialog ── */}
      {saveDialogOpen && (
        <Modal onClose={() => setSaveDialogOpen(false)}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#00ff88', textShadow: '0 0 8px rgba(0,255,136,0.5)', letterSpacing: '0.06em' }}>Save Level</h3>
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px' }}>Insert at position (1 = first, blank = last):</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <input
              type="number" min={1} placeholder={`${savedLevels.length + 1} (last)`}
              value={savePosition} onChange={(e) => setSavePosition(e.target.value)}
              style={{ ...iStyle, width: 90 }}
              autoFocus
            />
            <span style={{ fontSize: 11, color: '#334155' }}>of {savedLevels.length + 1}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <NBtn onClick={() => doSave(savePosition)} color="#00ff88" style={{ padding: '7px 20px', fontSize: 12 }}>Save</NBtn>
            <NBtn onClick={() => setSaveDialogOpen(false)} style={{ padding: '7px 16px', fontSize: 12 }}>Cancel</NBtn>
          </div>
        </Modal>
      )}

      {/* ── Paste JSON dialog ── */}
      {pasteDialogOpen && (
        <Modal onClose={() => { setPasteDialogOpen(false); setPasteError(''); setPasteText(''); }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, color: '#00c4ff', letterSpacing: '0.06em' }}>Paste JSON</h3>
          <p style={{ fontSize: 11, color: '#334155', margin: '0 0 10px' }}>Paste a LevelData JSON object below:</p>
          {pasteError && <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{pasteError}</p>}
          <textarea
            value={pasteText} onChange={(e) => setPasteText(e.target.value)}
            placeholder='{ "id": 1, "name": "...", ... }'
            style={{ width: 360, height: 200, background: '#060d1a', border: '1px solid rgba(30,58,95,0.5)', color: '#94a3b8', fontFamily: 'monospace', fontSize: 11, borderRadius: 6, padding: 10, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <NBtn onClick={handlePaste} color="#00c4ff" style={{ padding: '7px 20px', fontSize: 12 }}>Load</NBtn>
            <NBtn onClick={() => { setPasteDialogOpen(false); setPasteError(''); setPasteText(''); }} style={{ padding: '7px 16px', fontSize: 12 }}>Cancel</NBtn>
          </div>
        </Modal>
      )}

      {/* ── Test modal ── */}
      {testLevel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,5,14,0.88)', backdropFilter: 'blur(6px)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 700, padding: '0 16px' }}>
            <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#00ff88', textShadow: '0 0 8px rgba(0,255,136,0.5)' }}>Test Mode</span>
            <button onClick={() => setTestLevel(null)} style={{ fontSize: 12, padding: '6px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', borderRadius: 7, cursor: 'pointer' }}>✕ Close</button>
          </div>
          <GameShell level={testLevel} />
        </div>
      )}
    </div>
  );
}

// ─── Modal wrapper ───────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,5,14,0.82)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'rgba(6,13,26,0.98)', border: '1px solid rgba(30,58,95,0.6)', borderRadius: 14, padding: '24px 28px', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ─── Edge indicator ──────────────────────────────────────────────────────────

function EdgeInd({ behavior, axis }: { behavior: EdgeBehavior; axis: 'h' | 'v' }) {
  if (behavior === 'wall') return null;
  const isLava = behavior === 'lava';
  return (
    <div style={{ fontSize: 12, color: isLava ? '#ef4444' : '#9333ea', textShadow: isLava ? '0 0 7px rgba(239,68,68,0.7)' : '0 0 7px rgba(147,51,234,0.7)', userSelect: 'none', padding: '0 3px' }}>
      {isLava ? '☠' : axis === 'h' ? '↕' : '↔'}
    </div>
  );
}

// ─── Object dot overlay ──────────────────────────────────────────────────────

function ObjDot({ color, size, label }: { color: string; size: number; label: string }) {
  const pad = Math.floor(size * 0.14);
  const s = size - pad * 2;
  return (
    <div style={{ position: 'absolute', top: pad, left: pad, width: s, height: s, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}, 0 0 16px ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}>
      <span style={{ fontSize: s * 0.38, fontWeight: 900, color: color === '#00ff88' ? '#003320' : '#002233', lineHeight: 1 }}>{label}</span>
    </div>
  );
}

// ─── Page export ─────────────────────────────────────────────────────────────

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div style={{ height: '100dvh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em' }}>LOADING...</span>
      </div>
    }>
      <EditorInner />
    </Suspense>
  );
}
