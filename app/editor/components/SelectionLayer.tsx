'use client';

import { useRef, useState, useCallback } from 'react';
import { useEditorContext } from '../EditorContext';
import type { SelectionRect } from '../EditorContext';

function rectStyle(sel: SelectionRect, cellSize: number): React.CSSProperties {
  const r0 = Math.min(sel.r0, sel.r1);
  const r1 = Math.max(sel.r0, sel.r1);
  const c0 = Math.min(sel.c0, sel.c1);
  const c1 = Math.max(sel.c0, sel.c1);
  return {
    position: 'absolute',
    top: r0 * cellSize,
    left: c0 * cellSize,
    width: (c1 - c0 + 1) * cellSize,
    height: (r1 - r0 + 1) * cellSize,
    border: '2px solid rgba(0,196,255,0.85)',
    background: 'rgba(0,196,255,0.08)',
    pointerEvents: 'none',
    zIndex: 20,
    borderRadius: 3,
  };
}

function ghostStyle(sel: SelectionRect, dr: number, dc: number, cellSize: number): React.CSSProperties {
  const r0 = Math.min(sel.r0, sel.r1) + dr;
  const c0 = Math.min(sel.c0, sel.c1) + dc;
  const r1 = Math.max(sel.r0, sel.r1) + dr;
  const c1 = Math.max(sel.c0, sel.c1) + dc;
  return {
    position: 'absolute',
    top: r0 * cellSize,
    left: c0 * cellSize,
    width: (c1 - c0 + 1) * cellSize,
    height: (r1 - r0 + 1) * cellSize,
    border: '2px dashed rgba(0,196,255,0.5)',
    background: 'rgba(0,196,255,0.04)',
    pointerEvents: 'none',
    zIndex: 21,
    borderRadius: 3,
  };
}

function isInsideRect(r: number, c: number, sel: SelectionRect): boolean {
  const r0 = Math.min(sel.r0, sel.r1);
  const r1 = Math.max(sel.r0, sel.r1);
  const c0 = Math.min(sel.c0, sel.c1);
  const c1 = Math.max(sel.c0, sel.c1);
  return r >= r0 && r <= r1 && c >= c0 && c <= c1;
}

export default function SelectionLayer() {
  const { activeTool, selection, setSelection, moveSelection, cellSize, width, height } = useEditorContext();
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [phase, setPhase] = useState<'idle' | 'selecting' | 'moving'>('idle');
  const dragStartCell = useRef<{ r: number; c: number } | null>(null);
  const [ghostOffset, setGhostOffset] = useState({ dr: 0, dc: 0 });

  const pixelToCell = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { r: 0, c: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return {
      r: Math.max(0, Math.min(height - 1, Math.floor(y / cellSize))),
      c: Math.max(0, Math.min(width - 1, Math.floor(x / cellSize))),
    };
  }, [cellSize, height, width]);

  if (activeTool !== 'select') {
    return null;
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const cell = pixelToCell(e.clientX, e.clientY);
    if (selection && isInsideRect(cell.r, cell.c, selection)) {
      // Start move
      setPhase('moving');
      dragStartCell.current = cell;
      setGhostOffset({ dr: 0, dc: 0 });
    } else {
      // Start new selection
      setPhase('selecting');
      dragStartCell.current = cell;
      setSelection({ r0: cell.r, c0: cell.c, r1: cell.r, c1: cell.c });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (phase === 'idle') return;
    const cell = pixelToCell(e.clientX, e.clientY);
    if (phase === 'selecting' && dragStartCell.current) {
      setSelection({
        r0: dragStartCell.current.r,
        c0: dragStartCell.current.c,
        r1: cell.r,
        c1: cell.c,
      });
    } else if (phase === 'moving' && dragStartCell.current && selection) {
      setGhostOffset({
        dr: cell.r - dragStartCell.current.r,
        dc: cell.c - dragStartCell.current.c,
      });
    }
  };

  const handleMouseUp = () => {
    if (phase === 'moving' && selection && (ghostOffset.dr !== 0 || ghostOffset.dc !== 0)) {
      // Normalise selection rect before moving
      const sel: SelectionRect = {
        r0: Math.min(selection.r0, selection.r1),
        c0: Math.min(selection.c0, selection.c1),
        r1: Math.max(selection.r0, selection.r1),
        c1: Math.max(selection.c0, selection.c1),
      };
      moveSelection(sel, ghostOffset.dr, ghostOffset.dc);
      // Update selection to new position
      setSelection({
        r0: sel.r0 + ghostOffset.dr,
        c0: sel.c0 + ghostOffset.dc,
        r1: sel.r1 + ghostOffset.dr,
        c1: sel.c1 + ghostOffset.dc,
      });
    }
    setPhase('idle');
    dragStartCell.current = null;
    setGhostOffset({ dr: 0, dc: 0 });
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', inset: 0,
        cursor: phase === 'moving' ? 'grabbing' : (selection ? 'default' : 'crosshair'),
        zIndex: 15,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {selection && <div style={rectStyle(selection, cellSize)} />}
      {phase === 'moving' && selection && (ghostOffset.dr !== 0 || ghostOffset.dc !== 0) && (
        <div style={ghostStyle(selection, ghostOffset.dr, ghostOffset.dc, cellSize)} />
      )}
    </div>
  );
}
