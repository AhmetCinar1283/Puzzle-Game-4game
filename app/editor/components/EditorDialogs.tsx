'use client';

import type { User } from 'firebase/auth';
import type { StoredLevel } from '@/app/src/lib/db';
import { Modal, NBtn, iStyle } from './EditorUI';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '../editorConfig';

interface EditorDialogsProps {
  // Save dialog
  saveDialogOpen: boolean;
  onSaveClose: () => void;
  savePosition: string;
  setSavePosition: (v: string) => void;
  savedLevels: (StoredLevel & { id: number })[];
  onSave: (pos?: string) => void;
  // Submit dialog
  submitDialogOpen: boolean;
  onSubmitClose: () => void;
  submitNote: string;
  setSubmitNote: (v: string) => void;
  submitError: string;
  submitStatus: string;
  savedRequestId: string | null;
  levelName: string;
  difficulty: 1 | 2 | 3 | 4;
  user: User | null;
  userTag: string | null;
  onSubmit: () => void;
  // Paste dialog
  pasteDialogOpen: boolean;
  onPasteClose: () => void;
  pasteText: string;
  setPasteText: (v: string) => void;
  pasteError: string;
  onPaste: () => void;
}

export default function EditorDialogs({
  saveDialogOpen, onSaveClose, savePosition, setSavePosition, savedLevels, onSave,
  submitDialogOpen, onSubmitClose, submitNote, setSubmitNote,
  submitError, submitStatus, savedRequestId, levelName, difficulty, user, userTag, onSubmit,
  pasteDialogOpen, onPasteClose, pasteText, setPasteText, pasteError, onPaste,
}: EditorDialogsProps) {
  return (
    <>
      {/* Save position dialog */}
      {saveDialogOpen && (
        <Modal onClose={onSaveClose}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#00ff88', textShadow: '0 0 8px rgba(0,255,136,0.5)', letterSpacing: '0.06em' }}>Save Level</h3>
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px' }}>Insert at position (1 = first, blank = last):</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <input
              type="number" min={1} placeholder={`${savedLevels.length + 1} (last)`}
              value={savePosition} onChange={(e) => setSavePosition(e.target.value)}
              style={{ ...iStyle, width: 90 }}
              autoFocus
            />
            <span style={{ fontSize: 11, color: '#334155' }}>of {savedLevels.length + 1}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <NBtn onClick={() => onSave(savePosition)} color="#00ff88" style={{ padding: '7px 20px', fontSize: 12 }}>Save</NBtn>
            <NBtn onClick={onSaveClose} style={{ padding: '7px 16px', fontSize: 12 }}>Cancel</NBtn>
          </div>
        </Modal>
      )}

      {/* Submit level dialog */}
      {submitDialogOpen && (
        <Modal onClose={onSubmitClose}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#a78bfa', letterSpacing: '0.06em', textShadow: '0 0 8px rgba(167,139,250,0.5)' }}>
            {savedRequestId ? 'Talebi Güncelle' : 'Level Talebi Gönder'}
          </h3>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155', display: 'block', marginBottom: 4 }}>Level Adı</span>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>{levelName || 'Unnamed Level'}</span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155', display: 'block', marginBottom: 4 }}>Hazırlayan</span>
            <span style={{ fontSize: 13, color: '#a78bfa' }}>
              {userTag ?? user?.displayName ?? user?.email ?? 'Unknown'}
            </span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155', display: 'block', marginBottom: 4 }}>Zorluk</span>
            <span style={{ fontSize: 13, color: DIFFICULTY_COLORS[difficulty], fontWeight: 700 }}>
              {DIFFICULTY_LABELS[difficulty]}
            </span>
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155', display: 'block', marginBottom: 4 }}>Not (opsiyonel)</span>
            <textarea
              value={submitNote} onChange={(e) => setSubmitNote(e.target.value)}
              placeholder="Level hakkında kısa bir açıklama..."
              style={{ width: 320, height: 60, background: '#060d1a', border: '1px solid rgba(30,58,95,0.5)', color: '#94a3b8', fontFamily: 'inherit', fontSize: 12, borderRadius: 6, padding: 8, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {submitError && <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{submitError}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <NBtn onClick={onSubmit} color="#a78bfa" active style={{ padding: '7px 20px', fontSize: 12 }}>
              {submitStatus || (savedRequestId ? 'Güncelle' : 'Gönder')}
            </NBtn>
            <NBtn onClick={onSubmitClose} style={{ padding: '7px 16px', fontSize: 12 }}>İptal</NBtn>
          </div>
          <p style={{ fontSize: 10, color: '#1e3a5f', margin: '10px 0 0', lineHeight: 1.5 }}>
            {savedRequestId ? 'Mevcut talep güncellenir.' : 'Gönderilen level admin onayından sonra kampanyaya eklenir.'}
          </p>
        </Modal>
      )}

      {/* Paste JSON dialog */}
      {pasteDialogOpen && (
        <Modal onClose={onPasteClose}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, color: '#00c4ff', letterSpacing: '0.06em' }}>Paste JSON</h3>
          <p style={{ fontSize: 11, color: '#334155', margin: '0 0 10px' }}>Paste a LevelData JSON object below:</p>
          {pasteError && <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{pasteError}</p>}
          <textarea
            value={pasteText} onChange={(e) => setPasteText(e.target.value)}
            placeholder='{ "id": 1, "name": "...", ... }'
            style={{ width: 360, height: 200, background: '#060d1a', border: '1px solid rgba(30,58,95,0.5)', color: '#94a3b8', fontFamily: 'monospace', fontSize: 11, borderRadius: 6, padding: 10, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <NBtn onClick={onPaste} color="#00c4ff" style={{ padding: '7px 20px', fontSize: 12 }}>Load</NBtn>
            <NBtn onClick={onPasteClose} style={{ padding: '7px 16px', fontSize: 12 }}>Cancel</NBtn>
          </div>
        </Modal>
      )}
    </>
  );
}
