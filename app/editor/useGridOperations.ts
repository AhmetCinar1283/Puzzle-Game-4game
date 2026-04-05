'use client';

import { useCallback } from 'react';
import type { CellType, Position } from '@/app/src/games/types';
import type { ObjConfig, BoxConfig } from './editorConfig';

export interface SelectionRect {
  r0: number; c0: number; r1: number; c1: number;
}

interface GridOpsParams {
  grid: CellType[][];
  setGrid: React.Dispatch<React.SetStateAction<CellType[][]>>;
  width: number;
  setWidth: React.Dispatch<React.SetStateAction<number>>;
  height: number;
  setHeight: React.Dispatch<React.SetStateAction<number>>;
  objects: ObjConfig[];
  setObjects: React.Dispatch<React.SetStateAction<ObjConfig[]>>;
  boxes: BoxConfig[];
  setBoxes: React.Dispatch<React.SetStateAction<BoxConfig[]>>;
  conveyorPowerRequired: Position[];
  setConveyorPowerRequired: React.Dispatch<React.SetStateAction<Position[]>>;
  pushGridHistory?: () => void;
}

export function useGridOperations(p: GridOpsParams) {
  const addRow = useCallback((afterIndex: number) => {
    p.pushGridHistory?.();
    // afterIndex=0 → insert before row 0 (top), afterIndex=height → append (bottom)
    p.setGrid((g) => [
      ...g.slice(0, afterIndex),
      Array(g[0]?.length ?? p.width).fill('empty' as CellType),
      ...g.slice(afterIndex),
    ]);
    p.setHeight((h) => h + 1);
    p.setObjects((os) => os.map((o) =>
      o.row !== null && o.row >= afterIndex ? { ...o, row: o.row + 1 } : o
    ));
    p.setBoxes((bs) => bs.map((b) =>
      b.row !== null && b.row >= afterIndex ? { ...b, row: b.row + 1 } : b
    ));
    p.setConveyorPowerRequired((cpr) => cpr.map((pos) =>
      pos.row >= afterIndex ? { ...pos, row: pos.row + 1 } : pos
    ));
  }, [p]);

  const removeRow = useCallback((index: number) => {
    if (p.height <= 3) return;
    p.pushGridHistory?.();
    p.setGrid((g) => g.filter((_, r) => r !== index));
    p.setHeight((h) => h - 1);
    p.setObjects((os) => os.map((o) => {
      if (o.row === index) return { ...o, row: null, col: null };
      if (o.row !== null && o.row > index) return { ...o, row: o.row - 1 };
      return o;
    }));
    p.setBoxes((bs) => bs.map((b) => {
      if (b.row === index) return { ...b, row: null, col: null };
      if (b.row !== null && b.row > index) return { ...b, row: b.row - 1 };
      return b;
    }));
    p.setConveyorPowerRequired((cpr) =>
      cpr.filter((pos) => pos.row !== index).map((pos) =>
        pos.row > index ? { ...pos, row: pos.row - 1 } : pos
      )
    );
  }, [p]);

  const addCol = useCallback((afterIndex: number) => {
    p.pushGridHistory?.();
    p.setGrid((g) => g.map((row) => [
      ...row.slice(0, afterIndex),
      'empty' as CellType,
      ...row.slice(afterIndex),
    ]));
    p.setWidth((w) => w + 1);
    p.setObjects((os) => os.map((o) =>
      o.col !== null && o.col >= afterIndex ? { ...o, col: o.col + 1 } : o
    ));
    p.setBoxes((bs) => bs.map((b) =>
      b.col !== null && b.col >= afterIndex ? { ...b, col: b.col + 1 } : b
    ));
    p.setConveyorPowerRequired((cpr) => cpr.map((pos) =>
      pos.col >= afterIndex ? { ...pos, col: pos.col + 1 } : pos
    ));
  }, [p]);

  const removeCol = useCallback((index: number) => {
    if (p.width <= 3) return;
    p.pushGridHistory?.();
    p.setGrid((g) => g.map((row) => row.filter((_, c) => c !== index)));
    p.setWidth((w) => w - 1);
    p.setObjects((os) => os.map((o) => {
      if (o.col === index) return { ...o, row: null, col: null };
      if (o.col !== null && o.col > index) return { ...o, col: o.col - 1 };
      return o;
    }));
    p.setBoxes((bs) => bs.map((b) => {
      if (b.col === index) return { ...b, row: null, col: null };
      if (b.col !== null && b.col > index) return { ...b, col: b.col - 1 };
      return b;
    }));
    p.setConveyorPowerRequired((cpr) =>
      cpr.filter((pos) => pos.col !== index).map((pos) =>
        pos.col > index ? { ...pos, col: pos.col - 1 } : pos
      )
    );
  }, [p]);

  const moveSelection = useCallback((sel: SelectionRect, dr: number, dc: number) => {
    if (dr === 0 && dc === 0) return;
    const { r0, c0, r1, c1 } = sel;
    const selH = r1 - r0 + 1;
    const selW = c1 - c0 + 1;
    const destR0 = r0 + dr;
    const destC0 = c0 + dc;

    p.setGrid((g) => {
      const next = g.map((row) => [...row]);
      // Extract selection content
      const chunk: CellType[][] = [];
      for (let r = r0; r <= r1; r++) {
        const rowChunk: CellType[] = [];
        for (let c = c0; c <= c1; c++) rowChunk.push(g[r]?.[c] ?? 'empty');
        chunk.push(rowChunk);
      }
      // Clear source
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++)
          if (next[r]?.[c] !== undefined) next[r][c] = 'empty';
      // Write to destination (clamp to grid)
      for (let r = 0; r < selH; r++)
        for (let c = 0; c < selW; c++) {
          const tr = destR0 + r;
          const tc = destC0 + c;
          if (tr >= 0 && tr < g.length && tc >= 0 && tc < (g[0]?.length ?? 0))
            next[tr][tc] = chunk[r][c];
        }
      return next;
    });

    // Shift objects/boxes that were in the source selection
    p.setObjects((os) => os.map((o) => {
      if (o.row === null) return o;
      if (o.row >= r0 && o.row <= r1 && o.col !== null && o.col >= c0 && o.col <= c1) {
        const nr = o.row + dr;
        const nc = o.col + dc;
        if (nr >= 0 && nr < p.height && nc >= 0 && nc < p.width)
          return { ...o, row: nr, col: nc };
        return { ...o, row: null, col: null };
      }
      return o;
    }));
    p.setBoxes((bs) => bs.map((b) => {
      if (b.row === null) return b;
      if (b.row >= r0 && b.row <= r1 && b.col !== null && b.col >= c0 && b.col <= c1) {
        const nr = b.row + dr;
        const nc = b.col + dc;
        if (nr >= 0 && nr < p.height && nc >= 0 && nc < p.width)
          return { ...b, row: nr, col: nc };
        return { ...b, row: null, col: null };
      }
      return b;
    }));
  }, [p]);

  return { addRow, removeRow, addCol, removeCol, moveSelection };
}
