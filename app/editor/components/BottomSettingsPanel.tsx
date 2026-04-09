'use client';

import { useState } from 'react';
import { useEditorContext } from '../EditorContext';
import { useT } from '@/app/src/contexts/LanguageContext';

export default function BottomSettingsPanel({ isMobile, visible }: { isMobile: boolean; visible?: boolean }) {
  const { grid, width, height, boxes, setBoxes, activePlacingBoxId, setActivePlacingBoxId,
    setActiveTool, conveyorPowerRequired, setConveyorPowerRequired,
    conveyorConfig, setConveyorConfig, launcherConfig, setLauncherConfig,
    trampolineConfig, setTrampolineConfig } = useEditorContext();
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  // Collect conveyor cells
  const conveyorCells: { r: number; c: number }[] = [];
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++)
      if (['conveyor_up', 'conveyor_down', 'conveyor_left', 'conveyor_right'].includes(grid[r][c]))
        conveyorCells.push({ r, c });

  // Collect launcher cells
  const launcherCells: { r: number; c: number }[] = [];
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++)
      if (['launcher_up', 'launcher_down', 'launcher_left', 'launcher_right'].includes(grid[r][c]))
        launcherCells.push({ r, c });

  // Collect trampoline cells
  const trampolineCells: { r: number; c: number }[] = [];
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++)
      if (['trampoline_up', 'trampoline_down', 'trampoline_left', 'trampoline_right'].includes(grid[r][c]))
        trampolineCells.push({ r, c });

  const hasContent = boxes.length > 0 || conveyorCells.length > 0 || launcherCells.length > 0 || trampolineCells.length > 0;

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
          {launcherCells.length > 0 && (
            <span style={{ fontSize: 11, color: '#f59e0b' }}>▲ {launcherCells.length} launcher{launcherCells.length > 1 ? 's' : ''}</span>
          )}
          {trampolineCells.length > 0 && (
            <span style={{ fontSize: 11, color: '#22d3ee' }}>▲ {trampolineCells.length} trampoline{trampolineCells.length > 1 ? 's' : ''}</span>
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

          {/* Conveyor config: power requirements + step counts */}
          {conveyorCells.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#c4b5fd', marginBottom: 8 }}>
                Conveyors
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {conveyorCells.map(({ r, c }) => {
                  const isRequired = conveyorPowerRequired.some((p) => p.row === r && p.col === c);
                  const cfgEntry = conveyorConfig.find((x) => x.position.row === r && x.position.col === c);
                  const steps = cfgEntry?.steps ?? 1;
                  return (
                    <div key={`${r},${c}`} style={{
                      display: 'flex', flexDirection: 'column', gap: 4,
                      padding: '6px 8px', minWidth: 100,
                      background: 'rgba(139,92,246,0.05)',
                      border: '1px solid rgba(139,92,246,0.2)',
                      borderRadius: 6,
                    }}>
                      <span style={{ fontSize: 10, color: '#c4b5fd', fontWeight: 700 }}>
                        {grid[r][c]} ({r},{c})
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                        <input
                          type="checkbox" checked={isRequired}
                          onChange={(e) => {
                            if (e.target.checked) setConveyorPowerRequired((cpr) => [...cpr, { row: r, col: c }]);
                            else setConveyorPowerRequired((cpr) => cpr.filter((p) => !(p.row === r && p.col === c)));
                          }}
                          style={{ accentColor: '#c4b5fd', width: 11, height: 11 }}
                        />
                        <span style={{ fontSize: 9, color: isRequired ? '#c4b5fd' : '#475569' }}>⚡ {t('editor.conveyor_needs_power')}</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 9, color: '#c4b5fd' }}>Steps:</span>
                        <input
                          type="number" min={1} max={20} value={steps}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                            setConveyorConfig((cc) => {
                              const without = cc.filter((x) => !(x.position.row === r && x.position.col === c));
                              if (val === 1) return without; // default → omit
                              return [...without, { position: { row: r, col: c }, steps: val }];
                            });
                          }}
                          style={{
                            width: 40, padding: '2px 4px', fontSize: 10,
                            background: 'rgba(139,92,246,0.1)',
                            border: '1px solid rgba(139,92,246,0.3)',
                            color: '#c4b5fd', borderRadius: 4, outline: 'none',
                          }}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Launcher config: step counts */}
          {launcherCells.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 8 }}>
                Launchers
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {launcherCells.map(({ r, c }) => {
                  const cfgEntry = launcherConfig.find((x) => x.position.row === r && x.position.col === c);
                  const steps = cfgEntry?.steps ?? 3;
                  return (
                    <div key={`${r},${c}`} style={{
                      display: 'flex', flexDirection: 'column', gap: 4,
                      padding: '6px 8px', minWidth: 100,
                      background: 'rgba(245,158,11,0.05)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      borderRadius: 6,
                    }}>
                      <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>
                        {grid[r][c]} ({r},{c})
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 9, color: '#f59e0b' }}>Steps:</span>
                        <input
                          type="number" min={1} max={20} value={steps}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(20, parseInt(e.target.value) || 3));
                            setLauncherConfig((lc) => {
                              const without = lc.filter((x) => !(x.position.row === r && x.position.col === c));
                              if (val === 3) return without; // default → omit
                              return [...without, { position: { row: r, col: c }, steps: val }];
                            });
                          }}
                          style={{
                            width: 40, padding: '2px 4px', fontSize: 10,
                            background: 'rgba(245,158,11,0.1)',
                            border: '1px solid rgba(245,158,11,0.3)',
                            color: '#f59e0b', borderRadius: 4, outline: 'none',
                          }}
                        />
                      </label>
                    </div>
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
