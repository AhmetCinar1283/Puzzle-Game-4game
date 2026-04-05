'use client';

import { useState } from 'react';
import { useEditorContext } from '../EditorContext';
import { useT } from '@/app/src/contexts/LanguageContext';

export default function BottomSettingsPanel({ isMobile, visible }: { isMobile: boolean; visible?: boolean }) {
  const { grid, width, height, boxes, setBoxes, activePlacingBoxId, setActivePlacingBoxId,
    setActiveTool, conveyorPowerRequired, setConveyorPowerRequired } = useEditorContext();
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  // Collect conveyor cells
  const conveyorCells: { r: number; c: number }[] = [];
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++)
      if (['conveyor_up', 'conveyor_down', 'conveyor_left', 'conveyor_right'].includes(grid[r][c]))
        conveyorCells.push({ r, c });

  const hasContent = boxes.length > 0 || conveyorCells.length > 0;

  if (!hasContent) return null;
  if (isMobile && !visible) return null;

  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid rgba(30,58,95,0.4)',
      background: 'rgba(3,7,18,0.97)',
      transition: 'max-height 0.2s ease',
    }}>
      {/* Collapsed header row */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px', cursor: 'pointer', userSelect: 'none',
          height: 40,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {boxes.length > 0 && (
            <span style={{ fontSize: 11, color: '#f97316' }}>▣ {boxes.length} box{boxes.length > 1 ? 'es' : ''}</span>
          )}
          {conveyorCells.length > 0 && (
            <span style={{ fontSize: 11, color: '#c4b5fd' }}>◄► {conveyorCells.length} conveyor{conveyorCells.length > 1 ? 's' : ''}</span>
          )}
        </div>
        <span style={{ fontSize: 12, color: '#334155', transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Boxes */}
          {boxes.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f97316', marginBottom: 8 }}>Boxes</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {boxes.map((box) => {
                  const isPlacing = activePlacingBoxId === box.id;
                  return (
                    <div key={box.id} style={{
                      flexShrink: 0,
                      padding: '8px 10px', minWidth: 110,
                      background: isPlacing ? 'rgba(249,115,22,0.1)' : 'rgba(249,115,22,0.04)',
                      border: `1px solid ${isPlacing ? 'rgba(249,115,22,0.5)' : 'rgba(249,115,22,0.2)'}`,
                      borderRadius: 8,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#f97316', fontWeight: 700 }}>▣</span>
                        <button
                          onClick={() => setBoxes((bs) => bs.filter((b) => b.id !== box.id))}
                          style={{ fontSize: 10, background: 'none', border: 'none', color: '#334155', cursor: 'pointer' }}
                        >✕</button>
                      </div>
                      <div style={{ fontSize: 10, color: box.row !== null ? '#f97316' : '#334155', marginBottom: 6 }}>
                        {box.row !== null ? `(${box.row}, ${box.col})` : t('editor.not_placed')}
                        {box.row !== null && (
                          <button
                            onClick={() => setBoxes((bs) => bs.map((b) => b.id === box.id ? { ...b, row: null, col: null } : b))}
                            style={{ marginLeft: 4, fontSize: 9, background: 'none', border: 'none', color: '#334155', cursor: 'pointer' }}
                          >✕</button>
                        )}
                      </div>
                      <button
                        onClick={() => { setActivePlacingBoxId(box.id); setActiveTool('place_box'); }}
                        style={{
                          width: '100%', padding: '3px 0', fontSize: 9,
                          background: isPlacing ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.06)',
                          border: `1px solid ${isPlacing ? 'rgba(249,115,22,0.6)' : 'rgba(249,115,22,0.25)'}`,
                          color: '#f97316', borderRadius: 5, cursor: 'pointer', marginBottom: 6,
                        }}
                      >
                        {isPlacing ? t('editor.box_placing') : t('editor.box_place')}
                      </button>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                        <input
                          type="checkbox" checked={box.requiresPower}
                          onChange={(e) => setBoxes((bs) => bs.map((b) => b.id === box.id ? { ...b, requiresPower: e.target.checked } : b))}
                          style={{ accentColor: '#fbbf24', width: 11, height: 11 }}
                        />
                        <span style={{ fontSize: 9, color: box.requiresPower ? '#fbbf24' : '#475569' }}>⚡ {t('editor.box_needs_power')}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conveyor power requirements */}
          {conveyorCells.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#c4b5fd', marginBottom: 8 }}>
                {t('editor.conveyor_needs_power')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {conveyorCells.map(({ r, c }) => {
                  const isRequired = conveyorPowerRequired.some((p) => p.row === r && p.col === c);
                  return (
                    <label key={`${r},${c}`} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input
                        type="checkbox" checked={isRequired}
                        onChange={(e) => {
                          if (e.target.checked) setConveyorPowerRequired((cpr) => [...cpr, { row: r, col: c }]);
                          else setConveyorPowerRequired((cpr) => cpr.filter((p) => !(p.row === r && p.col === c)));
                        }}
                        style={{ accentColor: '#c4b5fd', width: 11, height: 11 }}
                      />
                      <span style={{ fontSize: 10, color: isRequired ? '#c4b5fd' : '#475569' }}>
                        {grid[r][c]} ({r},{c})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
