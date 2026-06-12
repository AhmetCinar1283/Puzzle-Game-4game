'use client';

import { useState } from 'react';
import { useEditorContext } from '../EditorContext';
import { useT } from '@/app/src/contexts/LanguageContext';

export default function BottomSettingsPanel({ isMobile, visible }: { isMobile: boolean; visible?: boolean }) {
  const { grid, setGrid, rooms, width, height, boxes, setBoxes, activePlacingBoxId, setActivePlacingBoxId,
    setActiveTool, conveyorPowerRequired, setConveyorPowerRequired,
    conveyorConfig, setConveyorConfig,
    trampolineConfig, setTrampolineConfig,
    deflectorConfig, setDeflectorConfig, activeRoomId } = useEditorContext();
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  // Collect conveyor cells
  const conveyorCells: { r: number; c: number }[] = [];
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++)
      if (grid[r] && grid[r][c] && ['conveyor_up', 'conveyor_down', 'conveyor_left', 'conveyor_right'].includes(grid[r][c]))
        conveyorCells.push({ r, c });

  // Collect trampoline cells
  const trampolineCells: { r: number; c: number }[] = [];
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++)
      if (grid[r] && grid[r][c] && ['trampoline_up', 'trampoline_down', 'trampoline_left', 'trampoline_right'].includes(grid[r][c]))
        trampolineCells.push({ r, c });

  // Collect control_switch cells
  const controlSwitchCells: { r: number; c: number }[] = [];
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++)
      if (grid[r] && grid[r][c] && grid[r][c].startsWith('control_switch'))
        controlSwitchCells.push({ r, c });

  // Collect direction deflector cells
  const deflectorCells: { r: number; c: number }[] = [];
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++)
      if (grid[r] && grid[r][c] && grid[r][c] === 'direction_deflector')
        deflectorCells.push({ r, c });

  const updateControlSwitch = (r: number, c: number, newAction: string, newTargetRooms: string[]) => {
    const newVal = `control_switch_${newAction}_${newTargetRooms.join(',')}`;
    setGrid((g) => {
      const next = g.map((row) => [...row]);
      next[r][c] = newVal as any;
      return next;
    });
  };

  const hasContent = boxes.length > 0 || conveyorCells.length > 0 || trampolineCells.length > 0 || controlSwitchCells.length > 0 || deflectorCells.length > 0;

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
          {trampolineCells.length > 0 && (
            <span style={{ fontSize: 11, color: '#22d3ee' }}>▲ {trampolineCells.length} trampoline{trampolineCells.length > 1 ? 's' : ''}</span>
          )}
          {controlSwitchCells.length > 0 && (
            <span style={{ fontSize: 11, color: '#a855f7' }}>❖ {controlSwitchCells.length} control switch{controlSwitchCells.length > 1 ? 'es' : ''}</span>
          )}
          {deflectorCells.length > 0 && (
            <span style={{ fontSize: 11, color: '#ec4899' }}>⤭ {deflectorCells.length} deflector{deflectorCells.length > 1 ? 's' : ''}</span>
          )}
        </div>
        <span style={{ fontSize: 12, color: '#334155', transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'row', gap: 12, overflowX: 'auto' }}>

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
                      padding: '8px 10px', minWidth: 130,
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
                      
                      {/* Requires Power */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', marginBottom: 4 }}>
                        <input
                          type="checkbox" checked={box.requiresPower}
                          onChange={(e) => setBoxes((bs) => bs.map((b) => b.id === box.id ? { ...b, requiresPower: e.target.checked } : b))}
                          style={{ accentColor: '#fbbf24', width: 11, height: 11 }}
                        />
                        <span style={{ fontSize: 9, color: box.requiresPower ? '#fbbf24' : '#475569' }}>⚡ {t('editor.box_needs_power')}</span>
                      </label>

                      {/* Durability Setting */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', marginBottom: 4 }}>
                        <input
                          type="checkbox" checked={box.durabilityEnabled}
                          onChange={(e) => setBoxes((bs) => bs.map((b) => b.id === box.id ? { ...b, durabilityEnabled: e.target.checked } : b))}
                          style={{ accentColor: '#ef4444', width: 11, height: 11 }}
                        />
                        <span style={{ fontSize: 9, color: box.durabilityEnabled ? '#ef4444' : '#475569' }}>🪵 Kırılgan Yap</span>
                      </label>
                      {box.durabilityEnabled && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, marginLeft: 16 }}>
                          <span style={{ fontSize: 9, color: '#64748b' }}>Limit:</span>
                          <input
                            type="number" min={1} max={99} value={box.durability ?? 3}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(99, parseInt(e.target.value) || 1));
                              setBoxes((bs) => bs.map((b) => b.id === box.id ? { ...b, durability: val } : b));
                            }}
                            style={{
                              width: 36, padding: '1px 3px', fontSize: 9,
                              background: '#090d16',
                              border: '1px solid rgba(239,68,68,0.4)',
                              color: '#ef4444', borderRadius: 4, outline: 'none',
                            }}
                          />
                        </div>
                      )}

                      {/* Color Filter Setting */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', marginBottom: 4 }}>
                        <input
                          type="checkbox" checked={box.colorFilterEnabled}
                          onChange={(e) => setBoxes((bs) => bs.map((b) => b.id === box.id ? { ...b, colorFilterEnabled: e.target.checked } : b))}
                          style={{ accentColor: '#00c4ff', width: 11, height: 11 }}
                        />
                        <span style={{ fontSize: 9, color: box.colorFilterEnabled ? '#00c4ff' : '#475569' }}>🎨 Renk Filtresi</span>
                      </label>
                      {box.colorFilterEnabled && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, marginLeft: 16 }}>
                          <span style={{ fontSize: 9, color: '#64748b' }}>Karakter:</span>
                          <select
                            value={box.colorFilterIndex ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setBoxes((bs) => bs.map((b) => b.id === box.id ? { ...b, colorFilterIndex: val } : b));
                            }}
                            style={{
                              background: '#0f172a',
                              border: '1px solid rgba(0,196,255,0.4)',
                              borderRadius: 4,
                              color: '#00c4ff',
                              fontSize: 9,
                              padding: '1px 2px',
                              outline: 'none',
                            }}
                          >
                            <option value={0}>P1 (Emerald)</option>
                            <option value={1}>P2 (Sky)</option>
                            <option value={2}>P3 (Purple)</option>
                            <option value={3}>P4 (Orange)</option>
                            <option value={4}>P5 (Pink)</option>
                            <option value={5}>P6 (Yellow)</option>
                          </select>
                        </div>
                      )}
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

          {/* Trampoline config: step counts */}
          {trampolineCells.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: 8 }}>
                Trampolines
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {trampolineCells.map(({ r, c }) => {
                  const cfgEntry = trampolineConfig.find((x) => x.position.row === r && x.position.col === c);
                  // Default step sayısı interface'de belirtildiği gibi 3 olarak alındı
                  const steps = cfgEntry?.steps ?? 3;

                  return (
                    <div key={`${r},${c}`} style={{
                      display: 'flex', flexDirection: 'column', gap: 4,
                      padding: '6px 8px', minWidth: 100,
                      background: 'rgba(34,211,238,0.05)',
                      border: '1px solid rgba(34,211,238,0.2)',
                      borderRadius: 6,
                    }}>
                      <span style={{ fontSize: 10, color: '#22d3ee', fontWeight: 700 }}>
                        {grid[r][c]} ({r},{c})
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 9, color: '#22d3ee' }}>Steps:</span>
                        <input
                          type="number" min={1} max={20} value={steps}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                            setTrampolineConfig((tc) => {
                              const without = tc.filter((x) => !(x.position.row === r && x.position.col === c));
                              if (val === 3) return without; // Varsayılan değerdeyse gereksiz yere state'te tutmaya gerek yok
                              return [...without, { position: { row: r, col: c }, steps: val }];
                            });
                          }}
                          style={{
                            width: 40, padding: '2px 4px', fontSize: 10,
                            background: 'rgba(34,211,238,0.1)',
                            border: '1px solid rgba(34,211,238,0.3)',
                            color: '#22d3ee', borderRadius: 4, outline: 'none',
                          }}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Control Switch Config */}
          {controlSwitchCells.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#a855f7', marginBottom: 8 }}>
                Control Switches
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {controlSwitchCells.map(({ r, c }) => {
                  const cellVal = grid[r][c];
                  let action = 'set';
                  let targetRooms: string[] = [];
                  if (cellVal.startsWith('control_switch_')) {
                    const parts = cellVal.split('_');
                    action = parts[2] || 'set';
                    targetRooms = parts[3] ? parts[3].split(',') : [];
                  }

                  return (
                    <div key={`${r},${c}`} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      padding: '8px 10px',
                      minWidth: 150,
                      background: 'rgba(168,85,247,0.05)',
                      border: '1px solid rgba(168,85,247,0.2)',
                      borderRadius: 6,
                    }}>
                      <span style={{ fontSize: 10, color: '#a855f7', fontWeight: 700 }}>
                        Switch ({r},{c})
                      </span>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 9, color: '#64748b' }}>Action:</span>
                        <select
                          value={action}
                          onChange={(e) => {
                            updateControlSwitch(r, c, e.target.value, targetRooms);
                          }}
                          style={{
                            background: '#0f172a',
                            border: '1px solid rgba(168,85,247,0.3)',
                            borderRadius: 4,
                            color: '#a855f7',
                            fontSize: 10,
                            padding: '2px 4px',
                            outline: 'none',
                          }}
                        >
                          <option value="set">Set</option>
                          <option value="toggle">Toggle</option>
                          <option value="cycle">Cycle</option>
                          <option value="add">Add</option>
                          <option value="remove">Remove</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 9, color: '#64748b' }}>Target Rooms:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 80, overflowY: 'auto', background: '#090d16', padding: '4px 6px', borderRadius: 4, border: '1px solid rgba(148,163,184,0.1)' }}>
                          {rooms.map((room) => {
                            const isChecked = targetRooms.includes(room.id);
                            return (
                              <label key={room.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: isChecked ? '#a855f7' : '#94a3b8' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const nextTargets = e.target.checked
                                      ? [...targetRooms, room.id]
                                      : targetRooms.filter((id) => id !== room.id);
                                    updateControlSwitch(r, c, action, nextTargets);
                                  }}
                                  style={{ accentColor: '#a855f7', width: 10, height: 10 }}
                                />
                                {room.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Direction Deflectors */}
          {deflectorCells.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#ec4899', marginBottom: 8 }}>
                Deflectors
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {deflectorCells.map(({ r, c }) => {
                  const cfgEntry = deflectorConfig.find((x) => (x.position.roomId ?? 'main') === activeRoomId && x.position.row === r && x.position.col === c);
                  const mapping = cfgEntry?.mapping ?? { up: 'right', right: 'down', down: 'left', left: 'up' };

                  return (
                    <div key={`${r},${c}`} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: '6px 8px',
                      minWidth: 140,
                      background: 'rgba(236,72,153,0.05)',
                      border: '1px solid rgba(236,72,153,0.2)',
                      borderRadius: 6,
                    }}>
                      <span style={{ fontSize: 10, color: '#ec4899', fontWeight: 700 }}>
                        Deflector ({r},{c})
                      </span>
                      {(['up', 'right', 'down', 'left'] as const).map((fromDir) => {
                        const toDir = mapping[fromDir];
                        return (
                          <div key={fromDir} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontSize: 9, color: '#64748b', textTransform: 'capitalize' }}>{fromDir}:</span>
                            <select
                              value={toDir}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                setDeflectorConfig((prev) => {
                                  const without = prev.filter((x) => !((x.position.roomId ?? 'main') === activeRoomId && x.position.row === r && x.position.col === c));
                                  const current = prev.find((x) => (x.position.roomId ?? 'main') === activeRoomId && x.position.row === r && x.position.col === c);
                                  const newMapping = {
                                    up: 'right', right: 'down', down: 'left', left: 'up',
                                    ...(current?.mapping ?? {}),
                                    [fromDir]: val,
                                  };
                                  return [...without, { position: { roomId: activeRoomId, row: r, col: c }, mapping: newMapping as any }];
                                });
                              }}
                              style={{
                                background: '#0f172a',
                                border: '1px solid rgba(236,72,153,0.3)',
                                borderRadius: 4,
                                color: '#ec4899',
                                fontSize: 9,
                                padding: '1px 2px',
                                outline: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="up">Up</option>
                              <option value="right">Right</option>
                              <option value="down">Down</option>
                              <option value="left">Left</option>
                            </select>
                          </div>
                        );
                      })}
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
