'use client';

import { useRef } from 'react';
import type { CellType, EdgeBehavior } from '@/app/src/games/types';
import GameCell from '@/app/src/games/components/GameCell';
import {
  CELL_TYPES_BASIC, CELL_TYPES_ICE, CELL_TYPES_POWER,
  CELL_TYPES_CONVEYOR, CELL_TYPES_TELEPORTER,
  CELL_ICON, CELL_LABEL, CELL_COLOR, EDGE_COLOR,
  type ToolType, type ObjConfig, type BoxConfig,
} from '../editorConfig';

// ─── Overlays ────────────────────────────────────────────────────────────────

function EdgeInd({ behavior, axis }: { behavior: EdgeBehavior; axis: 'h' | 'v' }) {
  if (behavior === 'wall') return null;
  const isLava = behavior === 'lava';
  return (
    <div style={{
      fontSize: 12,
      color: isLava ? '#ef4444' : '#9333ea',
      textShadow: isLava ? '0 0 7px rgba(239,68,68,0.7)' : '0 0 7px rgba(147,51,234,0.7)',
      userSelect: 'none', padding: '0 3px',
    }}>
      {isLava ? '☠' : axis === 'h' ? '↕' : '↔'}
    </div>
  );
}

function ObjDot({ color, size, label }: { color: string; size: number; label: string }) {
  const pad = Math.floor(size * 0.14);
  const s = size - pad * 2;
  return (
    <div style={{
      position: 'absolute', top: pad, left: pad, width: s, height: s,
      borderRadius: '50%', background: color,
      boxShadow: `0 0 8px ${color}, 0 0 16px ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 10,
    }}>
      <span style={{ fontSize: s * 0.38, fontWeight: 900, color: color === '#00ff88' ? '#003320' : '#002233', lineHeight: 1 }}>
        {label}
      </span>
    </div>
  );
}

function BoxDot({ size, requiresPower }: { size: number; requiresPower: boolean }) {
  const pad = Math.round(size * 0.1);
  const s = size - pad * 2;
  return (
    <div style={{
      position: 'absolute', top: pad, left: pad, width: s, height: s,
      borderRadius: 6, background: 'rgba(15,23,35,0.9)', border: '2px solid #f97316',
      boxShadow: '0 0 8px rgba(249,115,22,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 10,
    }}>
      <span style={{ fontSize: s * 0.28, color: '#f97316', lineHeight: 1, fontWeight: 'bold', userSelect: 'none' }}>▣</span>
      {requiresPower && (
        <span style={{ position: 'absolute', top: 1, right: 2, fontSize: s * 0.2, color: '#fbbf24', lineHeight: 1, userSelect: 'none' }}>⚡</span>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface EditorGridProps {
  activeTool: ToolType;
  setActiveTool: (t: ToolType) => void;
  objects: ObjConfig[];
  boxes: BoxConfig[];
  activePlacingBoxId: number | null;
  setActivePlacingBoxId: (id: number | null) => void;
  setBoxes: React.Dispatch<React.SetStateAction<BoxConfig[]>>;
  grid: CellType[][];
  edges: Record<'top' | 'bottom' | 'left' | 'right', EdgeBehavior>;
  cellSize: number;
  paintCell: (r: number, c: number, isDrag: boolean) => void;
  isMobile: boolean;
  visible: boolean;
}

export default function EditorGrid({
  activeTool, setActiveTool, objects, boxes,
  activePlacingBoxId, setActivePlacingBoxId, setBoxes,
  grid, edges, cellSize, paintCell,
  isMobile, visible,
}: EditorGridProps) {
  const isPainting = useRef(false);

  const toolGroups = [
    { label: 'Basic', types: CELL_TYPES_BASIC },
    { label: 'Ice', types: CELL_TYPES_ICE },
    { label: 'Power', types: CELL_TYPES_POWER },
    { label: 'Conveyors', types: CELL_TYPES_CONVEYOR },
    { label: 'Teleporters', types: CELL_TYPES_TELEPORTER },
  ];

  return (
    <div style={{ flex: 1, display: isMobile ? (visible ? 'flex' : 'none') : 'flex', overflow: 'hidden' }}>

      {/* Tool palette */}
      <div style={{ width: 110, flexShrink: 0, borderRight: '1px solid rgba(30,58,95,0.3)', overflowY: 'auto', padding: '10px 6px' }}>
        {toolGroups.map(({ label, types }) => (
          <div key={label}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1e3a5f', marginBottom: 4, marginTop: label === 'Basic' ? 0 : 10 }}>
              {label}
            </div>
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTool(t as ToolType)}
                style={{
                  width: '100%', marginBottom: 2, padding: '5px 6px',
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 10,
                  fontWeight: activeTool === t ? 700 : 400,
                  border: `1px solid ${activeTool === t ? CELL_COLOR[t] : 'rgba(255,255,255,0.06)'}`,
                  background: activeTool === t ? `${CELL_COLOR[t]}18` : 'rgba(255,255,255,0.01)',
                  color: activeTool === t ? CELL_COLOR[t] : '#475569',
                  borderRadius: 5, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s',
                }}
              >
                <span style={{ fontSize: 11, lineHeight: 1 }}>{CELL_ICON[t]}</span>
                <span style={{ fontSize: 9 }}>{CELL_LABEL[t]}</span>
              </button>
            ))}
          </div>
        ))}

        {/* Erase */}
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => setActiveTool('erase')}
            style={{
              width: '100%', marginBottom: 2, padding: '5px 6px',
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 10,
              fontWeight: activeTool === 'erase' ? 700 : 400,
              border: `1px solid ${activeTool === 'erase' ? CELL_COLOR.erase : 'rgba(255,255,255,0.06)'}`,
              background: activeTool === 'erase' ? `${CELL_COLOR.erase}18` : 'rgba(255,255,255,0.01)',
              color: activeTool === 'erase' ? CELL_COLOR.erase : '#475569',
              borderRadius: 5, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s',
            }}
          >
            <span style={{ fontSize: 11 }}>⌫</span>
            <span style={{ fontSize: 9 }}>Erase</span>
          </button>
        </div>

        {/* Players */}
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1e3a5f', marginBottom: 4, marginTop: 10 }}>Players</div>
        {[1, 2].map((id) => {
          const tool = `place_obj${id}` as ToolType;
          const color = id === 1 ? '#00ff88' : '#00c4ff';
          const obj = objects.find((o) => o.id === id)!;
          return (
            <button
              key={id}
              onClick={() => setActiveTool(tool)}
              style={{
                width: '100%', marginBottom: 2, padding: '5px 6px',
                display: 'flex', flexDirection: 'column', gap: 1, fontSize: 10,
                fontWeight: activeTool === tool ? 700 : 400,
                border: `1px solid ${activeTool === tool ? color : 'rgba(255,255,255,0.06)'}`,
                background: activeTool === tool ? `${color}18` : 'rgba(255,255,255,0.01)',
                color: activeTool === tool ? color : '#475569',
                borderRadius: 5, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s',
              }}
            >
              <span>● P{id}</span>
              {obj.row !== null && <span style={{ fontSize: 8, opacity: 0.6 }}>({obj.row},{obj.col})</span>}
            </button>
          );
        })}

        {/* Boxes */}
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1e3a5f', marginBottom: 4, marginTop: 10 }}>Boxes</div>
        <button
          onClick={() => {
            const newId = Date.now();
            setBoxes((bs) => [...bs, { id: newId, row: null, col: null, requiresPower: false }]);
            setActivePlacingBoxId(newId);
            setActiveTool('place_box');
          }}
          style={{ width: '100%', padding: '5px 6px', fontSize: 9, border: '1px solid rgba(249,115,22,0.35)', background: 'rgba(249,115,22,0.06)', color: '#f97316', borderRadius: 5, cursor: 'pointer' }}
        >
          + Add Box
        </button>
        {activePlacingBoxId !== null && (
          <div style={{ fontSize: 8, color: '#f97316', marginTop: 4, textAlign: 'center', opacity: 0.8 }}>Click grid to place</div>
        )}
      </div>

      {/* Grid area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <EdgeInd behavior={edges.top} axis="h" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <EdgeInd behavior={edges.left} axis="v" />
            <div
              style={{
                border: '3px solid transparent',
                borderTopColor: EDGE_COLOR[edges.top],
                borderBottomColor: EDGE_COLOR[edges.bottom],
                borderLeftColor: EDGE_COLOR[edges.left],
                borderRightColor: EDGE_COLOR[edges.right],
                borderRadius: 6, overflow: 'hidden', background: '#060d1a',
                cursor: 'crosshair', userSelect: 'none',
                boxShadow: '0 0 40px rgba(0,0,0,0.7)', touchAction: 'none',
              }}
              onMouseLeave={() => { isPainting.current = false; }}
              onTouchStart={(e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                const cell = el?.closest('[data-cell]') as HTMLElement | null;
                if (!cell) return;
                isPainting.current = true;
                paintCell(Number(cell.dataset.row), Number(cell.dataset.col), false);
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                if (!isPainting.current) return;
                const touch = e.touches[0];
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                const cell = el?.closest('[data-cell]') as HTMLElement | null;
                if (!cell) return;
                paintCell(Number(cell.dataset.row), Number(cell.dataset.col), true);
              }}
              onTouchEnd={() => { isPainting.current = false; }}
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
                        data-cell="" data-row={r} data-col={c}
                        onMouseDown={(e) => { e.preventDefault(); isPainting.current = true; paintCell(r, c, false); }}
                        onMouseEnter={() => { if (isPainting.current) paintCell(r, c, true); }}
                        onMouseUp={() => { isPainting.current = false; }}
                      >
                        <GameCell cellType={cell} cellSize={cellSize} />
                        {isObj1 && <ObjDot color="#00ff88" size={cellSize} label="1" />}
                        {isObj2 && <ObjDot color="#00c4ff" size={cellSize} label="2" />}
                        {boxes.map((b) => b.row === r && b.col === c ? (
                          <BoxDot key={b.id} size={cellSize} requiresPower={b.requiresPower} />
                        ) : null)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <EdgeInd behavior={edges.right} axis="v" />
          </div>
          <EdgeInd behavior={edges.bottom} axis="h" />
          <p style={{ fontSize: 9, color: '#1e3a5f', margin: 0, letterSpacing: '0.08em' }}>
            Click to paint · Click same cell = clear · Drag to fill
          </p>
        </div>
      </div>
    </div>
  );
}
