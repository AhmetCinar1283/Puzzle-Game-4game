'use client';

import { useState } from 'react';
import { useEditorContext } from '../EditorContext';

const ADD_SIZE = 14; // thickness of the + strip

function AddBtn({ onClick, vertical = false }: { onClick: () => void; vertical?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={vertical ? 'Add column' : 'Add row'}
      style={{
        width: vertical ? ADD_SIZE : '100%',
        height: vertical ? '100%' : ADD_SIZE,
        minWidth: vertical ? ADD_SIZE : undefined,
        minHeight: vertical ? undefined : ADD_SIZE,
        flexShrink: 0,
        background: hov ? 'rgba(0,196,255,0.18)' : 'rgba(0,196,255,0.05)',
        border: `1px solid ${hov ? 'rgba(0,196,255,0.5)' : 'rgba(0,196,255,0.15)'}`,
        color: hov ? '#00c4ff' : '#1e3a5f',
        borderRadius: 3,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700,
        transition: 'all 0.12s',
        padding: 0,
      }}
    >+</button>
  );
}

/** w × h del button — slim strip aligned to the cell it deletes */
function DelBtn({ onClick, w, h }: { onClick: () => void; w: number; h: number }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Delete"
      style={{
        width: w, height: h,
        flexShrink: 0,
        background: hov ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.04)',
        border: `1px solid ${hov ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.15)'}`,
        color: hov ? '#ef4444' : '#3f2020',
        borderRadius: 3, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700,
        transition: 'all 0.12s',
        padding: 0,
      }}
    >×</button>
  );
}

const DEL_THICKNESS = 18; // height of col-del strip / width of row-del strip
export const COL_CTRL_H = DEL_THICKNESS; // total height of ColControls row
export const ROW_CTRL_W = DEL_THICKNESS + ADD_SIZE + 2; // total width of RowControls col (del + gap + add)

/** Renders column delete buttons + add-column buttons above the grid */
export function ColControls() {
  const { width, height, cellSize, addCol, removeCol } = useEditorContext();
  if (height < 1) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 2, height: COL_CTRL_H }}>
      <AddBtn onClick={() => addCol(0)} vertical />
      {Array.from({ length: width }, (_, c) => [
        <DelBtn key={`d${c}`} w={cellSize-ADD_SIZE} h={DEL_THICKNESS} onClick={() => removeCol(c)} />,
        <AddBtn key={`a${c}`}  onClick={() => addCol(c + 1)} vertical />,
      ])}
    </div>
  );
}

/** Renders row delete buttons + add-row buttons to the right of the grid */
export function RowControls() {
  const { height, cellSize, addRow, removeRow } = useEditorContext();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 1, marginLeft: 2, width: ROW_CTRL_W }}>
      <AddBtn onClick={() => addRow(0)} />
      {Array.from({ length: height }, (_, r) => [
        <DelBtn key={`d${r}`} w={DEL_THICKNESS} h={cellSize-ADD_SIZE} onClick={() => removeRow(r)} />,
        <AddBtn key={`a${r}`} onClick={() => addRow(r + 1)} />,
      ])}
    </div>
  );
}
