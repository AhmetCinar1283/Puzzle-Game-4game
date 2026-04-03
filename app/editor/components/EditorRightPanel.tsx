'use client';

import type { CellType, EdgeBehavior, MovementMode, Position } from '@/app/src/games/types';
import type { LevelPart } from '@/app/src/lib/firebase/admin';
import type { User } from 'firebase/auth';
import { Sec, Lbl, NBtn, iStyle } from './EditorUI';
import { EDGE_OPTIONS, EDGE_LABEL, EDGE_COLOR, DIFFICULTY_COLORS, type ObjConfig, type BoxConfig, type ToolType } from '../editorConfig';
import { useT } from '@/app/src/contexts/LanguageContext';

interface EditorRightPanelProps {
  levelName: string;
  setLevelName: (v: string) => void;
  difficulty: 1 | 2 | 3 | 4;
  setDifficulty: (d: 1 | 2 | 3 | 4) => void;
  pendingW: number;
  setPendingW: (v: number) => void;
  pendingH: number;
  setPendingH: (v: number) => void;
  applyResize: () => void;
  edges: Record<'top' | 'bottom' | 'left' | 'right', EdgeBehavior>;
  setEdges: React.Dispatch<React.SetStateAction<Record<'top' | 'bottom' | 'left' | 'right', EdgeBehavior>>>;
  trailCollision: boolean;
  setTrailCollision: (v: boolean) => void;
  grid: CellType[][];
  width: number;
  height: number;
  conveyorPowerRequired: Position[];
  setConveyorPowerRequired: React.Dispatch<React.SetStateAction<Position[]>>;
  objects: ObjConfig[];
  setObjects: React.Dispatch<React.SetStateAction<ObjConfig[]>>;
  boxes: BoxConfig[];
  setBoxes: React.Dispatch<React.SetStateAction<BoxConfig[]>>;
  activePlacingBoxId: number | null;
  setActivePlacingBoxId: (id: number | null) => void;
  setActiveTool: (t: ToolType) => void;
  testError: string | null;
  onTest: () => void;
  copied: boolean;
  onCopy: () => void;
  jsonString: string;
  isModerator: boolean;
  parts: LevelPart[];
  selectedPartId: string;
  setSelectedPartId: (v: string) => void;
  firestoreEditId: string | null;
  setFirestoreEditId: (v: string | null) => void;
  publishStatus: string;
  onPublish: () => void;
  isMobile: boolean;
  visible: boolean;
}

export default function EditorRightPanel({
  levelName, setLevelName, difficulty, setDifficulty,
  pendingW, setPendingW, pendingH, setPendingH, applyResize,
  edges, setEdges, trailCollision, setTrailCollision,
  grid, width, height, conveyorPowerRequired, setConveyorPowerRequired,
  objects, setObjects, boxes, setBoxes, activePlacingBoxId, setActivePlacingBoxId, setActiveTool,
  testError, onTest, copied, onCopy, jsonString,
  isModerator, parts, selectedPartId, setSelectedPartId,
  firestoreEditId, setFirestoreEditId, publishStatus, onPublish,
  isMobile, visible,
}: EditorRightPanelProps) {
  const t = useT();
  const conveyorCells: { r: number; c: number }[] = [];
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++)
      if (['conveyor_up', 'conveyor_down', 'conveyor_left', 'conveyor_right'].includes(grid[r][c]))
        conveyorCells.push({ r, c });

  return (
    <div style={{
      width: isMobile ? '100%' : 270, flexShrink: 0,
      borderLeft: isMobile ? 'none' : '1px solid rgba(30,58,95,0.4)',
      overflowY: 'auto', padding: '12px 14px',
      display: isMobile ? (visible ? 'block' : 'none') : 'block',
    }}>

      <Sec title={t('editor.level_info')}>
        <Lbl>{t('editor.name')}</Lbl>
        <input value={levelName} onChange={(e) => setLevelName(e.target.value)} style={{ ...iStyle, width: '100%', marginBottom: 10 }} />
        <Lbl>{t('editor.difficulty')}</Lbl>
        <div style={{ display: 'flex', gap: 4 }}>
          {([1, 2, 3, 4] as const).map((d) => (
            <NBtn key={d} onClick={() => setDifficulty(d)} active={difficulty === d} color={DIFFICULTY_COLORS[d]} style={{ flex: 1, padding: '3px 4px', fontSize: 9 }}>
              {t(`difficulty.${d}`)}
            </NBtn>
          ))}
        </div>
      </Sec>

      <Sec title={t('editor.grid_size')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <Lbl>W</Lbl>
            <input type="number" min={3} max={16} value={pendingW} onChange={(e) => setPendingW(Number(e.target.value))} style={{ ...iStyle, width: 50 }} />
          </div>
          <div>
            <Lbl>H</Lbl>
            <input type="number" min={3} max={16} value={pendingH} onChange={(e) => setPendingH(Number(e.target.value))} style={{ ...iStyle, width: 50 }} />
          </div>
          <div style={{ paddingTop: 16 }}>
            <NBtn onClick={applyResize} color="#00c4ff">Apply</NBtn>
          </div>
        </div>
      </Sec>

      <Sec title={t('editor.edges')}>
        {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
          <div key={side} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: 11, color: '#475569', textTransform: 'capitalize', width: 42 }}>{side}</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {EDGE_OPTIONS.map((opt) => (
                <NBtn key={opt} onClick={() => setEdges((e) => ({ ...e, [side]: opt }))} active={edges[side] === opt} color={EDGE_COLOR[opt]} style={{ padding: '3px 7px', fontSize: 10 }}>
                  {EDGE_LABEL[opt]}
                </NBtn>
              ))}
            </div>
          </div>
        ))}
      </Sec>

      <Sec title={t('editor.options')}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
          <input type="checkbox" checked={trailCollision} onChange={(e) => setTrailCollision(e.target.checked)} style={{ accentColor: '#00c4ff', width: 13, height: 13 }} />
          <span style={{ fontSize: 12, color: trailCollision ? '#00c4ff' : '#475569' }}>{t('editor.trail_collision')}</span>
        </label>
        {conveyorCells.length > 0 && (
          <>
            <Lbl>{t('editor.conveyor_needs_power')}</Lbl>
            {conveyorCells.map(({ r, c }) => {
              const isRequired = conveyorPowerRequired.some((p) => p.row === r && p.col === c);
              return (
                <label key={`${r},${c}`} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 4 }}>
                  <input
                    type="checkbox" checked={isRequired}
                    onChange={(e) => {
                      if (e.target.checked) setConveyorPowerRequired((cpr) => [...cpr, { row: r, col: c }]);
                      else setConveyorPowerRequired((cpr) => cpr.filter((p) => !(p.row === r && p.col === c)));
                    }}
                    style={{ accentColor: '#c4b5fd', width: 12, height: 12 }}
                  />
                  <span style={{ fontSize: 10, color: isRequired ? '#c4b5fd' : '#475569' }}>
                    {grid[r][c]} ({r},{c})
                  </span>
                </label>
              );
            })}
          </>
        )}
      </Sec>

      {objects.map((obj) => {
        const color = obj.id === 1 ? '#00ff88' : '#00c4ff';
        return (
          <Sec key={obj.id} title={t('editor.object', { n: obj.id })}>
            <div style={{ marginBottom: 8 }}>
              <Lbl>{t('editor.position')}</Lbl>
              <span style={{ fontSize: 12, color: obj.row !== null ? color : '#334155' }}>
                {obj.row !== null ? `(${obj.row}, ${obj.col})` : t('editor.not_placed')}
              </span>
              {obj.row !== null && (
                <button
                  onClick={() => setObjects((os) => os.map((o) => o.id === obj.id ? { ...o, row: null, col: null } : o))}
                  style={{ marginLeft: 8, fontSize: 10, background: 'none', border: 'none', color: '#334155', cursor: 'pointer' }}
                >✕</button>
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <Lbl>{t('editor.mode')}</Lbl>
              <div style={{ display: 'flex', gap: 5 }}>
                {(['normal', 'reversed'] as MovementMode[]).map((m) => (
                  <NBtn key={m} onClick={() => setObjects((os) => os.map((o) => o.id === obj.id ? { ...o, mode: m } : o))} active={obj.mode === m} color={color} style={{ padding: '3px 8px', fontSize: 10 }}>
                    {m === 'normal' ? t('editor.mode_normal') : t('editor.mode_reversed')}
                  </NBtn>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
              <input
                type="checkbox" checked={obj.lockOnTarget}
                onChange={(e) => setObjects((os) => os.map((o) => o.id === obj.id ? { ...o, lockOnTarget: e.target.checked } : o))}
                style={{ accentColor: color, width: 12, height: 12 }}
              />
              <span style={{ fontSize: 11, color: '#475569' }}>{t('editor.lock_target')}</span>
            </label>
          </Sec>
        );
      })}

      {boxes.length > 0 && (
        <Sec title={t('editor.boxes')}>
          {boxes.map((box) => {
            const isPlacing = activePlacingBoxId === box.id;
            return (
              <div key={box.id} style={{ marginBottom: 10, padding: '8px 10px', background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#f97316', fontWeight: 700 }}>{t('editor.box_label')}</span>
                  <button onClick={() => setBoxes((bs) => bs.filter((b) => b.id !== box.id))} style={{ fontSize: 10, background: 'none', border: 'none', color: '#334155', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: box.row !== null ? '#f97316' : '#334155' }}>
                    {box.row !== null ? `Pos: (${box.row}, ${box.col})` : t('editor.not_placed')}
                  </span>
                  {box.row !== null && (
                    <button onClick={() => setBoxes((bs) => bs.map((b) => b.id === box.id ? { ...b, row: null, col: null } : b))} style={{ marginLeft: 6, fontSize: 9, background: 'none', border: 'none', color: '#334155', cursor: 'pointer' }}>✕</button>
                  )}
                </div>
                <button
                  onClick={() => { setActivePlacingBoxId(box.id); setActiveTool('place_box'); }}
                  style={{ fontSize: 9, padding: '3px 8px', background: isPlacing ? 'rgba(249,115,22,0.18)' : 'rgba(249,115,22,0.06)', border: `1px solid ${isPlacing ? 'rgba(249,115,22,0.6)' : 'rgba(249,115,22,0.25)'}`, color: '#f97316', borderRadius: 5, cursor: 'pointer', marginBottom: 6, width: '100%' }}
                >
                  {isPlacing ? t('editor.box_placing') : t('editor.box_place')}
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={box.requiresPower}
                    onChange={(e) => setBoxes((bs) => bs.map((b) => b.id === box.id ? { ...b, requiresPower: e.target.checked } : b))}
                    style={{ accentColor: '#fbbf24', width: 12, height: 12 }}
                  />
                  <span style={{ fontSize: 10, color: box.requiresPower ? '#fbbf24' : '#475569' }}>{t('editor.box_needs_power')}</span>
                </label>
              </div>
            );
          })}
        </Sec>
      )}

      <Sec title={t('editor.actions')}>
        {testError && <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{testError}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <button onClick={onTest} style={{ padding: '9px', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.35)', color: '#00ff88', borderRadius: 8, cursor: 'pointer' }}>{t('editor.test_level')}</button>
          <button onClick={onCopy} style={{ padding: '9px', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: copied ? 'rgba(0,196,255,0.1)' : 'rgba(0,196,255,0.04)', border: `1px solid ${copied ? 'rgba(0,196,255,0.5)' : 'rgba(0,196,255,0.25)'}`, color: '#00c4ff', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }}>
            {copied ? t('editor.copied') : t('editor.copy_json')}
          </button>
        </div>
      </Sec>

      {isModerator && (
        <Sec title={t('editor.firestore_publish')}>
          <div style={{ marginBottom: 8 }}>
            <Lbl>{t('editor.part_label')}</Lbl>
            <select value={selectedPartId} onChange={(e) => setSelectedPartId(e.target.value)} style={{ ...iStyle, width: '100%' }}>
              {parts.length === 0 ? (
                <option value="1">{t('editor.part_default')}</option>
              ) : (
                parts.map((p) => (
                  <option key={p.partId} value={p.partId}>Part {p.partId} — {p.name}</option>
                ))
              )}
            </select>
          </div>
          {firestoreEditId && (
            <div style={{ fontSize: 9, color: '#fbbf24', marginBottom: 8, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 5, padding: '4px 8px' }}>
              {t('editor.fs_editing', { id: firestoreEditId.slice(0, 10) })}
              <button onClick={() => setFirestoreEditId(null)} style={{ marginLeft: 6, fontSize: 9, background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>{t('editor.fs_new')}</button>
            </div>
          )}
          <button
            onClick={onPublish}
            style={{ width: '100%', padding: '9px', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: publishStatus ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.06)', border: `1px solid ${publishStatus ? 'rgba(251,191,36,0.7)' : 'rgba(251,191,36,0.35)'}`, color: '#fbbf24', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {publishStatus || (firestoreEditId ? t('editor.update_firestore') : t('editor.publish_firestore'))}
          </button>
        </Sec>
      )}

      <Sec title={t('editor.json_preview')}>
        <textarea readOnly value={jsonString} style={{ width: '100%', height: 160, background: '#060d1a', border: '1px solid rgba(30,58,95,0.4)', color: '#334155', fontFamily: 'monospace', fontSize: 9, borderRadius: 6, padding: 8, resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }} />
      </Sec>
    </div>
  );
}
