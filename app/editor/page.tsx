'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { CellType, EdgeBehavior, MovementMode, LevelData } from '@/app/src/games/types';
import GameShell from '@/app/src/games/components/GameShell';
import GameCell from '@/app/src/games/components/GameCell';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolType = CellType | 'place_obj1' | 'place_obj2' | 'erase';

interface ObjConfig {
  id: number;
  row: number | null;
  col: number | null;
  mode: MovementMode;
  lockOnTarget: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL_TYPES: CellType[] = [
  'empty',
  'obstacle',
  'forbidden',
  'target_1',
  'target_2',
  'direction_toggle',
];

const CELL_LABELS: Record<CellType | 'erase', string> = {
  empty: 'Empty',
  obstacle: 'Obstacle',
  forbidden: 'Forbidden',
  target_1: 'Target 1',
  target_2: 'Target 2',
  direction_toggle: 'Dir Toggle',
  erase: 'Erase',
};

const CELL_ICON: Record<CellType | 'erase', string> = {
  empty: '▫',
  obstacle: '■',
  forbidden: '✕',
  target_1: '◎',
  target_2: '◎',
  direction_toggle: '⇄',
  erase: '⌫',
};

const CELL_TOOL_COLOR: Record<CellType | 'erase', string> = {
  empty: '#475569',
  obstacle: '#94a3b8',
  forbidden: '#ef4444',
  target_1: '#00ff88',
  target_2: '#00c4ff',
  direction_toggle: '#ffd700',
  erase: '#64748b',
};

const EDGE_OPTIONS: EdgeBehavior[] = ['wall', 'portal', 'lava'];
const EDGE_LABELS: Record<EdgeBehavior, string> = { wall: 'Wall', portal: 'Portal', lava: 'Lava' };
const EDGE_COLORS: Record<EdgeBehavior, string> = {
  wall: '#475569',
  portal: '#9333ea',
  lava: '#ef4444',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createGrid(w: number, h: number): CellType[][] {
  return Array.from({ length: h }, () =>
    Array.from({ length: w }, () => 'empty' as CellType),
  );
}

function resizeGrid(old: CellType[][], newW: number, newH: number): CellType[][] {
  return Array.from({ length: newH }, (_, r) =>
    Array.from({ length: newW }, (_, c) => old[r]?.[c] ?? 'empty'),
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NeonBtn({
  children,
  onClick,
  active,
  color = '#94a3b8',
  style,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  color?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.04em',
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
        background: active ? `${color}18` : 'rgba(255,255,255,0.03)',
        color: active ? color : '#64748b',
        borderRadius: 7,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: active ? `0 0 10px ${color}30` : 'none',
        transition: 'all 0.15s',
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#334155',
        display: 'block',
        marginBottom: 6,
      }}
    >
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#1e3a5f',
          borderBottom: '1px solid rgba(30,58,95,0.5)',
          paddingBottom: 6,
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EditorPage() {
  const router = useRouter();

  // Level metadata
  const [levelId, setLevelId] = useState(99);
  const [levelName, setLevelName] = useState('My Level');
  const [trailCollision, setTrailCollision] = useState(false);

  // Grid
  const [width, setWidth] = useState(5);
  const [height, setHeight] = useState(5);
  const [pendingW, setPendingW] = useState(5);
  const [pendingH, setPendingH] = useState(5);
  const [grid, setGrid] = useState<CellType[][]>(() => createGrid(5, 5));

  // Edges
  const [edges, setEdges] = useState<Record<'top' | 'bottom' | 'left' | 'right', EdgeBehavior>>({
    top: 'wall',
    bottom: 'wall',
    left: 'wall',
    right: 'wall',
  });

  // Objects
  const [objects, setObjects] = useState<ObjConfig[]>([
    { id: 1, row: null, col: null, mode: 'normal', lockOnTarget: true },
    { id: 2, row: null, col: null, mode: 'normal', lockOnTarget: true },
  ]);

  // Tool
  const [activeTool, setActiveTool] = useState<ToolType>('obstacle');

  // Painting state
  const isPainting = useRef(false);

  // Test mode
  const [testLevel, setTestLevel] = useState<LevelData | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // JSON
  const [copied, setCopied] = useState(false);

  // ── Resize grid ────────────────────────────────────────────────────────────
  const applyResize = useCallback(() => {
    const newW = Math.max(3, Math.min(16, pendingW));
    const newH = Math.max(3, Math.min(16, pendingH));
    setWidth(newW);
    setHeight(newH);
    setGrid((g) => resizeGrid(g, newW, newH));
    // Nullify object positions that are out of bounds
    setObjects((objs) =>
      objs.map((o) => ({
        ...o,
        row: o.row !== null && o.row < newH ? o.row : null,
        col: o.col !== null && o.col < newW ? o.col : null,
      })),
    );
  }, [pendingW, pendingH]);

  // ── Paint cell ─────────────────────────────────────────────────────────────
  const paintCell = useCallback(
    (r: number, c: number) => {
      if (activeTool === 'place_obj1') {
        setObjects((objs) =>
          objs.map((o) => (o.id === 1 ? { ...o, row: r, col: c } : o)),
        );
        return;
      }
      if (activeTool === 'place_obj2') {
        setObjects((objs) =>
          objs.map((o) => (o.id === 2 ? { ...o, row: r, col: c } : o)),
        );
        return;
      }

      const cellType: CellType = activeTool === 'erase' ? 'empty' : activeTool;

      setGrid((g) => {
        const next = g.map((row) => [...row]);
        // Only one target_1 and target_2 allowed
        if (cellType === 'target_1' || cellType === 'target_2') {
          for (let row = 0; row < next.length; row++) {
            for (let col = 0; col < next[row].length; col++) {
              if (next[row][col] === cellType) next[row][col] = 'empty';
            }
          }
        }
        next[r][c] = cellType;
        return next;
      });
    },
    [activeTool],
  );

  // ── Generate LevelData ─────────────────────────────────────────────────────
  const generateLevelData = useCallback((): { level: LevelData | null; error: string | null } => {
    const targets: { objectId: number; position: { row: number; col: number } }[] = [];
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (grid[r][c] === 'target_1') targets.push({ objectId: 1, position: { row: r, col: c } });
        if (grid[r][c] === 'target_2') targets.push({ objectId: 2, position: { row: r, col: c } });
      }
    }

    const validObjs = objects.filter((o) => o.row !== null && o.col !== null);
    if (validObjs.length < 2) {
      return {
        level: null,
        error: 'Place both objects on the grid first.',
      };
    }

    const level: LevelData = {
      id: levelId,
      name: levelName,
      width,
      height,
      edges,
      grid,
      initialObjects: validObjs.map((o) => ({
        id: o.id,
        position: { row: o.row!, col: o.col! },
        mode: o.mode,
        lockOnTarget: o.lockOnTarget,
      })),
      targets,
      ...(trailCollision ? { trailCollision: true } : {}),
    };

    return { level, error: null };
  }, [levelId, levelName, width, height, edges, grid, objects, trailCollision]);

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

  const handleTest = useCallback(() => {
    const { level, error } = generateLevelData();
    if (error) {
      setTestError(error);
      return;
    }
    setTestError(null);
    setTestLevel(level);
  }, [generateLevelData]);

  // ── Editor cell size ────────────────────────────────────────────────────────
  const cellSize = Math.min(60, Math.floor(480 / Math.max(width, height)));

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#030712',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
          background: 'rgba(3,7,18,0.97)',
          borderBottom: '1px solid rgba(0,196,255,0.15)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none',
            border: 'none',
            color: '#334155',
            fontSize: 12,
            cursor: 'pointer',
            letterSpacing: '0.06em',
          }}
        >
          ← Back
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#00c4ff',
            textShadow: '0 0 12px rgba(0,196,255,0.5)',
          }}
        >
          Level Editor
        </h1>
        <div style={{ width: 48 }} />
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 0,
          overflow: 'auto',
        }}
      >
        {/* ── Left Panel: Tools ── */}
        <div
          style={{
            width: 160,
            flexShrink: 0,
            padding: '16px 12px',
            borderRight: '1px solid rgba(30,58,95,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            overflowY: 'auto',
          }}
        >
          <Section title="Cells">
            {([...CELL_TYPES, 'erase'] as (CellType | 'erase')[]).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTool(t as ToolType)}
                style={{
                  width: '100%',
                  marginBottom: 4,
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: activeTool === t ? 700 : 400,
                  border: `1px solid ${activeTool === t ? CELL_TOOL_COLOR[t] : 'rgba(255,255,255,0.07)'}`,
                  background: activeTool === t ? `${CELL_TOOL_COLOR[t]}18` : 'rgba(255,255,255,0.02)',
                  color: activeTool === t ? CELL_TOOL_COLOR[t] : '#475569',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: activeTool === t ? `0 0 8px ${CELL_TOOL_COLOR[t]}25` : 'none',
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 14 }}>{CELL_ICON[t]}</span>
                <span>{CELL_LABELS[t]}</span>
              </button>
            ))}
          </Section>

          <Section title="Objects">
            {[1, 2].map((id) => {
              const tool = `place_obj${id}` as ToolType;
              const color = id === 1 ? '#00ff88' : '#00c4ff';
              const obj = objects.find((o) => o.id === id)!;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTool(tool)}
                  style={{
                    width: '100%',
                    marginBottom: 4,
                    padding: '6px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    fontSize: 12,
                    fontWeight: activeTool === tool ? 700 : 400,
                    border: `1px solid ${activeTool === tool ? color : 'rgba(255,255,255,0.07)'}`,
                    background: activeTool === tool ? `${color}18` : 'rgba(255,255,255,0.02)',
                    color: activeTool === tool ? color : '#475569',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: activeTool === tool ? `0 0 8px ${color}25` : 'none',
                    transition: 'all 0.12s',
                  }}
                >
                  <span>● Place P{id}</span>
                  {obj.row !== null && (
                    <span style={{ fontSize: 10, opacity: 0.6 }}>
                      ({obj.row},{obj.col})
                    </span>
                  )}
                </button>
              );
            })}
          </Section>
        </div>

        {/* ── Center: Grid ── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {/* Top edge indicator */}
            <EdgeIndicator behavior={edges.top} axis="h" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Left edge indicator */}
              <EdgeIndicator behavior={edges.left} axis="v" />

              {/* Grid */}
              <div
                style={{
                  border: `3px solid ${EDGE_COLORS[edges.top]}`,
                  borderTopColor: EDGE_COLORS[edges.top],
                  borderBottomColor: EDGE_COLORS[edges.bottom],
                  borderLeftColor: EDGE_COLORS[edges.left],
                  borderRightColor: EDGE_COLORS[edges.right],
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: '#060d1a',
                  boxShadow: '0 0 40px rgba(0,0,0,0.8)',
                  cursor: 'crosshair',
                  userSelect: 'none',
                }}
                onMouseLeave={() => { isPainting.current = false; }}
              >
                {grid.map((row, r) => (
                  <div key={r} style={{ display: 'flex' }}>
                    {row.map((cell, c) => {
                      const isObj1 = objects[0].row === r && objects[0].col === c;
                      const isObj2 = objects[1].row === r && objects[1].col === c;
                      return (
                        <div
                          key={c}
                          style={{ position: 'relative' }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            isPainting.current = true;
                            paintCell(r, c);
                          }}
                          onMouseEnter={() => {
                            if (isPainting.current) paintCell(r, c);
                          }}
                          onMouseUp={() => { isPainting.current = false; }}
                        >
                          <GameCell cellType={cell} cellSize={cellSize} />
                          {/* Object overlays */}
                          {isObj1 && (
                            <ObjectDot color="#00ff88" size={cellSize} label="1" />
                          )}
                          {isObj2 && (
                            <ObjectDot color="#00c4ff" size={cellSize} label="2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Right edge indicator */}
              <EdgeIndicator behavior={edges.right} axis="v" />
            </div>

            {/* Bottom edge indicator */}
            <EdgeIndicator behavior={edges.bottom} axis="h" />

            <p style={{ fontSize: 10, color: '#1e3a5f', marginTop: 8, letterSpacing: '0.06em' }}>
              Click or drag to paint • Right column = settings
            </p>
          </div>
        </div>

        {/* ── Right Panel: Settings + Output ── */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            padding: '16px 16px',
            borderLeft: '1px solid rgba(30,58,95,0.4)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            msOverflowY: 'auto'
          }}
        >
          <Section title="Level Info">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <Label>ID</Label>
                <input
                  type="number"
                  value={levelId}
                  onChange={(e) => setLevelId(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label>Name</Label>
                <input
                  type="text"
                  value={levelName}
                  onChange={(e) => setLevelName(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
            </div>
          </Section>

          <Section title="Grid Size">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div>
                <Label>W</Label>
                <input
                  type="number"
                  min={3}
                  max={16}
                  value={pendingW}
                  onChange={(e) => setPendingW(Number(e.target.value))}
                  style={{ ...inputStyle, width: 52 }}
                />
              </div>
              <div>
                <Label>H</Label>
                <input
                  type="number"
                  min={3}
                  max={16}
                  value={pendingH}
                  onChange={(e) => setPendingH(Number(e.target.value))}
                  style={{ ...inputStyle, width: 52 }}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <NeonBtn onClick={applyResize} color="#00c4ff">
                  Apply
                </NeonBtn>
              </div>
            </div>
          </Section>

          <Section title="Edges">
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
              <div
                key={side}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}
              >
                <span style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize', width: 46 }}>
                  {side}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {EDGE_OPTIONS.map((opt) => (
                    <NeonBtn
                      key={opt}
                      onClick={() => setEdges((e) => ({ ...e, [side]: opt }))}
                      active={edges[side] === opt}
                      color={EDGE_COLORS[opt]}
                      style={{ padding: '3px 8px', fontSize: 11 }}
                    >
                      {EDGE_LABELS[opt]}
                    </NeonBtn>
                  ))}
                </div>
              </div>
            ))}
          </Section>

          <Section title="Options">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={trailCollision}
                onChange={(e) => setTrailCollision(e.target.checked)}
                style={{ accentColor: '#00c4ff', width: 14, height: 14 }}
              />
              <span style={{ fontSize: 12, color: trailCollision ? '#00c4ff' : '#475569' }}>
                Trail Collision
              </span>
            </label>
            {trailCollision && (
              <p style={{ fontSize: 10, color: '#1e3a5f', marginTop: 6, lineHeight: 1.5 }}>
                Landing on the opponent&apos;s trail causes a loss.
              </p>
            )}
          </Section>

          {objects.map((obj) => {
            const color = obj.id === 1 ? '#00ff88' : '#00c4ff';
            return (
              <Section key={obj.id} title={`Object ${obj.id}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <Label>Position</Label>
                    <span style={{ fontSize: 12, color: obj.row !== null ? color : '#334155' }}>
                      {obj.row !== null ? `Row ${obj.row}, Col ${obj.col}` : 'Not placed'}
                    </span>
                    {obj.row !== null && (
                      <button
                        onClick={() =>
                          setObjects((os) =>
                            os.map((o) =>
                              o.id === obj.id ? { ...o, row: null, col: null } : o,
                            ),
                          )
                        }
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          background: 'none',
                          border: 'none',
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div>
                    <Label>Mode</Label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['normal', 'reversed'] as MovementMode[]).map((m) => (
                        <NeonBtn
                          key={m}
                          onClick={() =>
                            setObjects((os) =>
                              os.map((o) => (o.id === obj.id ? { ...o, mode: m } : o)),
                            )
                          }
                          active={obj.mode === m}
                          color={color}
                          style={{ padding: '3px 10px', fontSize: 11, textTransform: 'capitalize' }}
                        >
                          {m === 'normal' ? '↻ Normal' : '↺ Reversed'}
                        </NeonBtn>
                      ))}
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={obj.lockOnTarget}
                      onChange={(e) =>
                        setObjects((os) =>
                          os.map((o) =>
                            o.id === obj.id ? { ...o, lockOnTarget: e.target.checked } : o,
                          ),
                        )
                      }
                      style={{ accentColor: color, width: 13, height: 13 }}
                    />
                    <span style={{ fontSize: 12, color: '#475569' }}>Lock on target</span>
                  </label>
                </div>
              </Section>
            );
          })}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {testError && (
              <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 0 }}>{testError}</p>
            )}
            <button
              onClick={handleTest}
              style={{
                padding: '10px',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'rgba(0,255,136,0.07)',
                border: '1px solid rgba(0,255,136,0.4)',
                color: '#00ff88',
                borderRadius: 8,
                cursor: 'pointer',
                boxShadow: '0 0 14px rgba(0,255,136,0.1)',
              }}
            >
              ▶ Test Level
            </button>
            <button
              onClick={handleCopy}
              style={{
                padding: '10px',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: copied ? 'rgba(0,196,255,0.12)' : 'rgba(0,196,255,0.05)',
                border: `1px solid ${copied ? 'rgba(0,196,255,0.6)' : 'rgba(0,196,255,0.3)'}`,
                color: '#00c4ff',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {copied ? '✓ Copied!' : '📋 Copy JSON'}
            </button>
          </div>

          {/* JSON Preview */}
          <div style={{ marginTop: 16 }}>
            <Label>JSON Output</Label>
            <textarea
              readOnly
              value={jsonString}
              style={{
                width: '100%',
                height: 200,
                background: '#060d1a',
                border: '1px solid rgba(30,58,95,0.5)',
                color: '#334155',
                fontFamily: 'monospace',
                fontSize: 10,
                borderRadius: 6,
                padding: 10,
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
                lineHeight: 1.5,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Test Modal ── */}
      {testLevel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,5,14,0.88)',
            backdropFilter: 'blur(6px)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: 700,
              padding: '0 16px',
            }}
          >
            <span
              style={{
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#00ff88',
                textShadow: '0 0 8px rgba(0,255,136,0.5)',
              }}
            >
              Test Mode
            </span>
            <button
              onClick={() => setTestLevel(null)}
              style={{
                fontSize: 13,
                padding: '6px 18px',
                background: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.35)',
                color: '#ef4444',
                borderRadius: 7,
                cursor: 'pointer',
                letterSpacing: '0.06em',
              }}
            >
              ✕ Close
            </button>
          </div>
          <GameShell level={testLevel} />
        </div>
      )}
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function EdgeIndicator({ behavior, axis }: { behavior: EdgeBehavior; axis: 'h' | 'v' }) {
  if (behavior === 'wall') return null;
  const isLava = behavior === 'lava';
  return (
    <div
      style={{
        fontSize: 12,
        color: isLava ? '#ef4444' : '#9333ea',
        textShadow: isLava ? '0 0 8px rgba(239,68,68,0.7)' : '0 0 8px rgba(147,51,234,0.7)',
        userSelect: 'none',
        padding: '0 4px',
      }}
    >
      {isLava ? '☠' : axis === 'h' ? '↕' : '↔'}
    </div>
  );
}

function ObjectDot({
  color,
  size,
  label,
}: {
  color: string;
  size: number;
  label: string;
}) {
  const pad = Math.floor(size * 0.15);
  const dotSize = size - pad * 2;
  return (
    <div
      style={{
        position: 'absolute',
        top: pad,
        left: pad,
        width: dotSize,
        height: dotSize,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 8px ${color}, 0 0 16px ${color}60`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontSize: dotSize * 0.38,
          fontWeight: 900,
          color: color === '#00ff88' ? '#003320' : '#002233',
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#060d1a',
  border: '1px solid rgba(30,58,95,0.6)',
  color: '#94a3b8',
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 12,
  outline: 'none',
  width: 64,
  boxSizing: 'border-box',
};
