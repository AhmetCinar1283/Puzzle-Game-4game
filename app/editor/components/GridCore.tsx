'use client';

import { useRef } from 'react';
import GameCell from '@/app/src/games/components/GameCell';
import { EDGE_COLOR } from '../editorConfig';
import { useEditorContext } from '../EditorContext';

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

export default function GridCore() {
  const { grid, objects, boxes, cellSize, edges, paintCell } = useEditorContext();
  const isPainting = useRef(false);

  return (
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
  );
}
