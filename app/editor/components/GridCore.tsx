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
  const { grid, objects, boxes, cellSize, edges, paintCell, lockedCells, optimalSolutionTrajectory } = useEditorContext();
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
      {optimalSolutionTrajectory && (() => {
        const getOffsetPoints = (points: { row: number; col: number }[], isPlayer2: boolean) => {
          const visitMap: Record<string, number> = {};
          return points.map((p, idx) => {
            const key = `${p.row},${p.col}`;
            const visitIndex = visitMap[key] || 0;
            visitMap[key] = visitIndex + 1;

            const baseX = p.col * cellSize + cellSize / 2;
            const baseY = p.row * cellSize + cellSize / 2;

            let dx = 0;
            let dy = 0;
            if (visitIndex > 0) {
              // Symmetrically offset visits. Shift Player 2 by an extra 22.5 degrees (PI/8) to prevent overlaps between player paths.
              const baseAngle = ((visitIndex - 1) * Math.PI / 2) + Math.PI / 4;
              const angle = isPlayer2 ? baseAngle + Math.PI / 8 : baseAngle;
              const dist = cellSize * 0.22;
              dx = Math.cos(angle) * dist;
              dy = Math.sin(angle) * dist;
            }

            return {
              x: baseX + dx,
              y: baseY + dy,
              row: p.row,
              col: p.col,
              step: idx,
            };
          });
        };

        const p1Offsets = optimalSolutionTrajectory.player1 ? getOffsetPoints(optimalSolutionTrajectory.player1, false) : [];
        const p2Offsets = optimalSolutionTrajectory.player2 ? getOffsetPoints(optimalSolutionTrajectory.player2, true) : [];

        const getSvgPathFromOffsets = (offsets: { x: number; y: number }[]) => {
          if (offsets.length < 2) return '';
          return offsets.reduce((acc, pt, idx) => {
            return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
          }, '');
        };

        const gridW = grid[0]?.length ?? 0;
        const gridH = grid.length;
        const circleRadius = cellSize * 0.16;
        const fontSize = Math.max(7, Math.round(cellSize * 0.18));

        return (
          <svg
            style={{
              position: 'absolute', top: 0, left: 0,
              width: gridW * cellSize, height: gridH * cellSize,
              pointerEvents: 'none', zIndex: 11
            }}
          >
            <defs>
              <filter id="pathGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes crawlPath {
                to { stroke-dashoffset: -20; }
              }
            `}} />
            {p1Offsets.length > 1 && (
              <path
                d={getSvgPathFromOffsets(p1Offsets)}
                fill="none"
                stroke="#00ff88"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="6, 6"
                filter="url(#pathGlow)"
                style={{ animation: 'crawlPath 1.2s linear infinite' }}
                opacity={0.8}
              />
            )}
            {p2Offsets.length > 1 && (
              <path
                d={getSvgPathFromOffsets(p2Offsets)}
                fill="none"
                stroke="#00c4ff"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="6, 6"
                filter="url(#pathGlow)"
                style={{ animation: 'crawlPath 1.2s linear infinite' }}
                opacity={0.8}
              />
            )}

            {/* Player 1 Waypoint Markers */}
            {p1Offsets.map((pt) => (
              <g key={`p1-${pt.step}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={circleRadius}
                  fill="#060d1a"
                  stroke="#00ff88"
                  strokeWidth={1.5}
                />
                <text
                  x={pt.x}
                  y={pt.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#00ff88"
                  fontSize={`${fontSize}px`}
                  fontWeight="bold"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {pt.step}
                </text>
              </g>
            ))}

            {/* Player 2 Waypoint Markers */}
            {p2Offsets.map((pt) => (
              <g key={`p2-${pt.step}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={circleRadius}
                  fill="#060d1a"
                  stroke="#00c4ff"
                  strokeWidth={1.5}
                />
                <text
                  x={pt.x}
                  y={pt.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#00c4ff"
                  fontSize={`${fontSize}px`}
                  fontWeight="bold"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {pt.step}
                </text>
              </g>
            ))}
          </svg>
        );
      })()}
      {grid.map((row, r) => (
        <div key={r} style={{ display: 'flex' }}>
          {row.map((cell, c) => {
            const isObj1 = objects[0].row === r && objects[0].col === c;
            const isObj2 = objects[1].row === r && objects[1].col === c;
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
                {isObj1 && <ObjDot color="#00ff88" size={cellSize} label="1" />}
                {isObj2 && <ObjDot color="#00c4ff" size={cellSize} label="2" />}
                {boxes.map((b) => b.row === r && b.col === c ? (
                  <BoxDot key={b.id} size={cellSize} requiresPower={b.requiresPower} />
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
