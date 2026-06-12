'use client';

import { useRef } from 'react';
import GameCell from '@/app/src/games/components/GameCell';
import type { EdgeBehavior } from '@/app/src/games/types';
import { EDGE_COLOR } from '../editorConfig';
import { useEditorContext } from '../EditorContext';
import { getPlayerColor } from '@/app/src/game2/components/playerColors';

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
      <span style={{ fontSize: s * 0.38, fontWeight: 900, color: '#000000', lineHeight: 1 }}>
        {label}
      </span>
    </div>
  );
}

interface BoxDotProps {
  size: number;
  requiresPower: boolean;
  durabilityEnabled?: boolean;
  durability?: number;
  colorFilterEnabled?: boolean;
  colorFilterIndex?: number;
}

function BoxDot({
  size,
  requiresPower,
  durabilityEnabled,
  durability,
  colorFilterEnabled,
  colorFilterIndex,
}: BoxDotProps) {
  const pad = Math.round(size * 0.1);
  const s = size - pad * 2;

  let themeColor = '#f97316';
  if (colorFilterEnabled) {
    themeColor = getPlayerColor(colorFilterIndex ?? 0).hex;
  }

  return (
    <div style={{
      position: 'absolute', top: pad, left: pad, width: s, height: s,
      borderRadius: 6,
      background: 'rgba(15,23,35,0.9)',
      border: `2px solid ${themeColor}`,
      boxShadow: `0 0 8px ${themeColor}80`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 10,
    }}>
      <span style={{ fontSize: s * 0.28, color: themeColor, lineHeight: 1, fontWeight: 'bold', userSelect: 'none' }}>▣</span>
      {requiresPower && (
        <span style={{ position: 'absolute', top: 1, right: 2, fontSize: s * 0.2, color: '#fbbf24', lineHeight: 1, userSelect: 'none' }}>⚡</span>
      )}
      {durabilityEnabled && (
        <div style={{
          position: 'absolute', bottom: 1, right: 2,
          fontSize: s * 0.24, fontWeight: 'bold', color: themeColor,
          lineHeight: 1, userSelect: 'none', fontFamily: 'monospace'
        }}>
          {durability}
        </div>
      )}
      {colorFilterEnabled && (
        <div style={{
          position: 'absolute', top: 2, left: 2,
          width: 5, height: 5, borderRadius: '50%',
          backgroundColor: themeColor,
          boxShadow: `0 0 4px ${themeColor}`,
        }} />
      )}
    </div>
  );
}

export default function GridCore() {
  const { grid, objects, boxes, cellSize, edges, paintCell, lockedCells, activeRoomId } = useEditorContext();
  const isPainting = useRef(false);

  return (
    <div
      style={{
        border: '3px solid transparent',
        borderTopColor: EDGE_COLOR[edges.top.type as EdgeBehavior],
        borderBottomColor: EDGE_COLOR[edges.bottom.type as EdgeBehavior],
        borderLeftColor: EDGE_COLOR[edges.left.type as EdgeBehavior],
        borderRightColor: EDGE_COLOR[edges.right.type as EdgeBehavior],
        borderRadius: 6, overflow: 'hidden', background: '#060d1a',
        cursor: 'crosshair', userSelect: 'none',
        boxShadow: '0 0 40px rgba(0,0,0,0.7)', touchAction: 'none',
        position: 'relative',
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
            const cellObjects = objects.filter((o) => (o.roomId ?? 'main') === activeRoomId && o.row === r && o.col === c);
            const isLocked = !!lockedCells[`${r},${c}`];
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
                {cellObjects.map((obj) => (
                  <ObjDot 
                    key={obj.id} 
                    color={getPlayerColor(obj.id - 1).hex} 
                    size={cellSize} 
                    label={String(obj.id)} 
                  />
                ))}
                {boxes.map((b) => (b.roomId ?? 'main') === activeRoomId && b.row === r && b.col === c ? (
                  <BoxDot
                    key={b.id}
                    size={cellSize}
                    requiresPower={b.requiresPower}
                    durabilityEnabled={b.durabilityEnabled}
                    durability={b.durability}
                    colorFilterEnabled={b.colorFilterEnabled}
                    colorFilterIndex={b.colorFilterIndex}
                  />
                ) : null)}
                {isLocked && (
                  <div style={{
                    position: 'absolute', top: 2, right: 2, zIndex: 12,
                    fontSize: Math.max(9, Math.round(cellSize * 0.3)),
                    pointerEvents: 'none', userSelect: 'none',
                    filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))'
                  }}>
                    🔒
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
