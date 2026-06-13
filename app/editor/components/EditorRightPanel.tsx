'use client';

import { useState } from 'react';
import type { MovementMode } from '@/app/src/games/types';
import { Sec, Lbl, NBtn, iStyle } from './EditorUI';
import { DIFFICULTY_COLORS } from '../editorConfig';
import { useEditorContext } from '../EditorContext';
import { useT } from '@/app/src/contexts/LanguageContext';

export default function EditorRightPanel({ isMobile, visible }: { isMobile: boolean; visible: boolean }) {
  const t = useT();
  const {
    levelName, setLevelName, difficulty, setDifficulty,
    pendingW, setPendingW, pendingH, setPendingH, applyResize,
    trailCollision, setTrailCollision,
    objects, setObjects, testError, handleTest,
    handleCopyBoard, handlePasteBoard, copied,
    isModerator, parts, selectedPartId, setSelectedPartId,
    firestoreEditId, setFirestoreEditId, publishStatus, doPublish,
    generateLevelData, setGeneratorDialogOpen,
    optimalSolution, optimalSolutionMoves,
    rooms, edges, setEdges,
    setRooms, activeRoomId,
  } = useEditorContext();

  const [pasteError, setPasteError] = useState('');

  // Dynamic Actions Panel State
  const [newBtnLabel, setNewBtnLabel] = useState('');
  const [newBtnType, setNewBtnType] = useState('toggle_lights');
  const [newBtnIcon, setNewBtnIcon] = useState('💡');
  const [newBtnTargetType, setNewBtnTargetType] = useState<'room' | 'entity'>('room');
  const [newBtnTargetId, setNewBtnTargetId] = useState('');

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  const handleAddRoomAction = () => {
    if (!newBtnLabel.trim()) return;
    
    setRooms(prevRooms => prevRooms.map(r => {
      if (r.id === activeRoomId) {
        const customData = r.customData || {};
        const staticButtons = customData.staticButtons || [];
        const newBtn = {
          id: `static:${r.id}:${Date.now()}`,
          actionType: newBtnType,
          label: newBtnLabel,
          icon: newBtnIcon,
          target: {
            type: newBtnTargetType,
            id: newBtnTargetType === 'entity' ? Number(newBtnTargetId || 1) : (newBtnTargetId || r.id)
          }
        };
        return {
          ...r,
          customData: {
            ...customData,
            staticButtons: [...staticButtons, newBtn]
          }
        };
      }
      return r;
    }));
    
    setNewBtnLabel('');
    setNewBtnTargetId('');
  };

  const handleDeleteRoomAction = (btnId: string) => {
    setRooms(prevRooms => prevRooms.map(r => {
      if (r.id === activeRoomId) {
        const customData = r.customData || {};
        const staticButtons = customData.staticButtons || [];
        return {
          ...r,
          customData: {
            ...customData,
            staticButtons: staticButtons.filter((b: any) => b.id !== btnId)
          }
        };
      }
      return r;
    }));
  };

  const onPasteBoard = () => {
    const err = handlePasteBoard();
    if (err) {
      setPasteError(err);
      setTimeout(() => setPasteError(''), 2500);
    }
  };

  return (
    <div style={{
      width: isMobile ? '100%' : 220, flexShrink: 0,
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
            <input type="number" min={3} max={16} value={pendingW} onChange={(e) => setPendingW(Number(e.target.value))} style={{ ...iStyle, width: 48 }} />
          </div>
          <div>
            <Lbl>H</Lbl>
            <input type="number" min={3} max={16} value={pendingH} onChange={(e) => setPendingH(Number(e.target.value))} style={{ ...iStyle, width: 48 }} />
          </div>
          <div style={{ paddingTop: 16 }}>
            <NBtn onClick={applyResize} color="#00c4ff">Apply</NBtn>
          </div>
        </div>
      </Sec>

      <Sec title={t('editor.options')}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={trailCollision} onChange={(e) => setTrailCollision(e.target.checked)} style={{ accentColor: '#00c4ff', width: 13, height: 13 }} />
          <span style={{ fontSize: 12, color: trailCollision ? '#00c4ff' : '#475569' }}>{t('editor.trail_collision')}</span>
        </label>
      </Sec>

      <Sec title="Room Actions">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {activeRoom?.customData?.staticButtons?.map((btn: any) => (
            <div key={btn.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(30,58,95,0.3)', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}>
              <span style={{ color: '#00c4ff' }}>{btn.icon} {btn.label}</span>
              <button
                onClick={() => handleDeleteRoomAction(btn.id)}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}
              >
                ✕
              </button>
            </div>
          ))}
          {(!activeRoom?.customData?.staticButtons || activeRoom.customData.staticButtons.length === 0) && (
            <div style={{ fontSize: 10, color: '#475569', fontStyle: 'italic' }}>No actions configured</div>
          )}
        </div>

        <div style={{ background: 'rgba(6,13,26,0.5)', border: '1px solid rgba(30,58,95,0.4)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <Lbl style={{ marginBottom: 2 }}>Label</Lbl>
            <input placeholder="e.g. Lock Player 1" value={newBtnLabel} onChange={(e) => setNewBtnLabel(e.target.value)} style={{ ...iStyle, width: '100%', padding: '3px 6px', fontSize: 11 }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Lbl style={{ marginBottom: 2 }}>Action Type</Lbl>
              <select value={newBtnType} onChange={(e) => setNewBtnType(e.target.value)} style={{ ...iStyle, width: '100%', padding: '3px 6px', fontSize: 11 }}>
                <option value="toggle_lights">Toggle Lights</option>
                <option value="lock_player">Lock/Unlock Player</option>
              </select>
            </div>
            <div style={{ width: 45 }}>
              <Lbl style={{ marginBottom: 2 }}>Icon</Lbl>
              <input value={newBtnIcon} onChange={(e) => setNewBtnIcon(e.target.value)} style={{ ...iStyle, width: '100%', padding: '3px 4px', fontSize: 11, textAlign: 'center' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Lbl style={{ marginBottom: 2 }}>Target Type</Lbl>
              <select value={newBtnTargetType} onChange={(e) => setNewBtnTargetType(e.target.value as any)} style={{ ...iStyle, width: '100%', padding: '3px 6px', fontSize: 11 }}>
                <option value="room">Room</option>
                <option value="entity">Entity (Player)</option>
              </select>
            </div>
            <div style={{ width: 55 }}>
              <Lbl style={{ marginBottom: 2 }}>Target ID</Lbl>
              <input placeholder={newBtnTargetType === 'room' ? activeRoomId : '1'} value={newBtnTargetId} onChange={(e) => setNewBtnTargetId(e.target.value)} style={{ ...iStyle, width: '100%', padding: '3px 6px', fontSize: 11 }} />
            </div>
          </div>
          <NBtn onClick={handleAddRoomAction} color="#00c4ff" style={{ width: '100%', padding: '4px 0', fontSize: 10 }}>
            + Add Action
          </NBtn>
        </div>
      </Sec>

      {/* Room boundary portals targets are configured interactively on the canvas */}

      {objects.map((obj) => {
        const color = obj.id === 1 ? '#00ff88' : '#00c4ff';
        const emoji = obj.id === 1 ? '🟢' : '🔵';
        return (
          <Sec key={obj.id} title={`${emoji} ${t('editor.object', { n: obj.id })}`}>
            <div style={{ marginBottom: 8 }}>
              <Lbl>{t('editor.position')}</Lbl>
              <span style={{ fontSize: 12, color: obj.row !== null ? color : '#334155' }}>
                {obj.row !== null ? `${obj.roomId ?? 'main'} (${obj.row}, ${obj.col})` : t('editor.not_placed')}
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

      {optimalSolution && (
        <Sec title="⚡ BFS OPTIMAL SOLUTION">
          <div style={{ background: '#040914', border: '1px solid rgba(0,196,255,0.25)', borderRadius: 8, padding: 10, boxShadow: '0 0 10px rgba(0,196,255,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#00c4ff', marginBottom: 6 }}>
              Solvable in: <span style={{ color: '#00ff88' }}>{optimalSolutionMoves} Moves</span>
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4, maxHeight: 110, overflowY: 'auto', background: '#060d1a', border: '1px solid rgba(30,58,95,0.4)', borderRadius: 5, padding: '6px 8px', fontFamily: 'monospace' }}>
              {optimalSolution.map((dir, idx) => (
                <span key={idx} style={{ textTransform: 'uppercase', color: dir === 'up' ? '#38bdf8' : dir === 'down' ? '#f43f5e' : dir === 'left' ? '#fbbf24' : '#34d399', display: 'inline-block', marginRight: 4, fontWeight: 'bold' }}>
                  {dir}{idx < optimalSolution.length - 1 ? ',' : ''}
                </span>
              ))}
            </div>
          </div>
        </Sec>
      )}

      <Sec title={t('editor.actions')}>
        {testError && <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{testError}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <button onClick={() => setGeneratorDialogOpen(true)} style={{ padding: '9px', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: 'rgba(0,196,255,0.06)', border: '1px solid rgba(0,196,255,0.35)', color: '#00c4ff', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            ⚡ Generate Level
          </button>
          <button onClick={handleTest} style={{ padding: '9px', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.35)', color: '#00ff88', borderRadius: 8, cursor: 'pointer' }}>
            {t('editor.test_level')}
          </button>
          <button onClick={handleCopyBoard} style={{ padding: '9px', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: copied ? 'rgba(0,196,255,0.1)' : 'rgba(0,196,255,0.04)', border: `1px solid ${copied ? 'rgba(0,196,255,0.5)' : 'rgba(0,196,255,0.25)'}`, color: '#00c4ff', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }}>
            {copied ? '✓ Copied' : 'Copy Board'}
          </button>
          <button onClick={onPasteBoard} style={{ padding: '9px', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: 'rgba(148,163,184,0.04)', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', borderRadius: 8, cursor: 'pointer' }}>
            Paste Board
          </button>
          {pasteError && <p style={{ fontSize: 10, color: '#ef4444', margin: 0 }}>{pasteError}</p>}
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
            onClick={doPublish}
            style={{ width: '100%', padding: '9px', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: publishStatus ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.06)', border: `1px solid ${publishStatus ? 'rgba(251,191,36,0.7)' : 'rgba(251,191,36,0.35)'}`, color: '#fbbf24', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {publishStatus || (firestoreEditId ? t('editor.update_firestore') : t('editor.publish_firestore'))}
          </button>
        </Sec>
      )}
    </div>
  );
}
