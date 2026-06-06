'use client';

import type { StoredLevel } from '@/app/src/lib/db';
import type { FirestoreLevel } from '@/app/src/lib/firebase/admin';
import { useT } from '@/app/src/contexts/LanguageContext';
import { useEditorContext } from '../EditorContext';

interface EditorLeftPanelProps {
  editId: number | null;
  levelsLoading: boolean;
  savedLevels: (StoredLevel & { id: number })[];
  isModerator: boolean;
  showFirestoreLevels: boolean;
  setShowFirestoreLevels: React.Dispatch<React.SetStateAction<boolean>>;
  firestoreLevels: FirestoreLevel[];
  firestoreEditId: string | null;
  selectedPartId: string;
  onLoadLevel: (stored: StoredLevel & { id: number }) => void;
  onNewLevel: () => void;
  onLoadFirestoreLevel: (fl: FirestoreLevel) => void;
  isMobile: boolean;
  visible: boolean;
}

export default function EditorLeftPanel({
  editId, levelsLoading, savedLevels, isModerator, showFirestoreLevels,
  setShowFirestoreLevels, firestoreLevels, firestoreEditId, selectedPartId,
  onLoadLevel, onNewLevel, onLoadFirestoreLevel, isMobile, visible,
}: EditorLeftPanelProps) {
  const t = useT();
  const { generatedCandidates, activeCandidateIndex, doGenerateLevel } = useEditorContext();

  return (
    <div style={{
      width: isMobile ? '100%' : 170, flexShrink: 0,
      borderRight: isMobile ? 'none' : '1px solid rgba(30,58,95,0.4)',
      display: isMobile ? (visible ? 'flex' : 'none') : 'flex',
      flexDirection: 'column', overflow: 'hidden',
    }}>
      {generatedCandidates.length > 0 && (
        <div style={{ flexShrink: 0, borderBottom: '1px solid rgba(30,58,95,0.4)', paddingBottom: 6 }}>
          <div style={{ padding: '10px 12px 6px' }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00c4ff', textShadow: '0 0 6px rgba(0,196,255,0.3)' }}>
              Alternatif Seviyeler
            </span>
          </div>
          <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {generatedCandidates.map((cand, idx) => {
              const active = activeCandidateIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => doGenerateLevel(cand.level, cand.solution, cand.moveCount, undefined, idx)}
                  style={{
                    width: '100%', padding: '6px 8px', textAlign: 'left',
                    background: active ? 'rgba(0,196,255,0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${active ? '#00c4ff' : 'rgba(255,255,255,0.06)'}`,
                    color: active ? '#00c4ff' : '#64748b',
                    borderRadius: 6, cursor: 'pointer', fontSize: 11,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>Seçenek {idx + 1}</span>
                  <span style={{ fontSize: 9, color: active ? '#00ff88' : '#1e3a5f', display: 'block', marginTop: 1 }}>
                    Hamle: {cand.moveCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ flexShrink: 0, padding: '10px 12px 6px', borderBottom: '1px solid rgba(30,58,95,0.3)' }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#1e3a5f' }}>{t('editor.saved_levels')}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {levelsLoading ? (
          <span style={{ fontSize: 11, color: '#1e3a5f' }}>{t('common.loading')}</span>
        ) : savedLevels.length === 0 ? (
          <span style={{ fontSize: 11, color: '#1e3a5f', lineHeight: 1.5, display: 'block', padding: '8px 4px' }}>
            {t('editor.no_saved')}
          </span>
        ) : (
          savedLevels.map((lv, idx) => (
            <button
              key={lv.id}
              onClick={() => onLoadLevel(lv)}
              style={{
                width: '100%', marginBottom: 4, padding: '7px 10px', textAlign: 'left',
                background: editId === lv.id ? 'rgba(0,196,255,0.1)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${editId === lv.id ? 'rgba(0,196,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                color: editId === lv.id ? '#00c4ff' : '#64748b',
                borderRadius: 6, cursor: 'pointer', fontSize: 12,
              }}
            >
              <span style={{ fontSize: 9, color: '#1e3a5f', display: 'block', marginBottom: 2 }}>#{idx + 1}</span>
              {lv.name}
              <span style={{ fontSize: 9, color: '#1e3a5f', display: 'block', marginTop: 1 }}>{lv.width}×{lv.height}</span>
            </button>
          ))
        )}
      </div>

      {isModerator && (
        <div style={{ borderTop: '1px solid rgba(30,58,95,0.3)', padding: '6px 8px' }}>
          <button
            onClick={() => setShowFirestoreLevels((v) => !v)}
            style={{
              width: '100%', padding: '5px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: showFirestoreLevels ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.03)',
              border: `1px solid ${showFirestoreLevels ? 'rgba(251,191,36,0.5)' : 'rgba(251,191,36,0.2)'}`,
              color: '#fbbf24', borderRadius: 6, cursor: 'pointer',
            }}
          >
            {showFirestoreLevels ? '▼' : '▶'} {t('editor.firestore_toggle')}
          </button>
          {showFirestoreLevels && (
            <div style={{ marginTop: 4 }}>
              {firestoreLevels.length === 0 ? (
                <span style={{ fontSize: 10, color: '#334155', padding: '4px 2px', display: 'block' }}>
                  {t('editor.no_fs_levels', { id: selectedPartId })}
                </span>
              ) : firestoreLevels.map((fl, idx) => (
                <button
                  key={fl.firestoreId}
                  onClick={() => onLoadFirestoreLevel(fl)}
                  style={{
                    width: '100%', marginBottom: 3, padding: '6px 8px', textAlign: 'left',
                    background: firestoreEditId === fl.firestoreId ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${firestoreEditId === fl.firestoreId ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    color: firestoreEditId === fl.firestoreId ? '#fbbf24' : '#64748b',
                    borderRadius: 5, cursor: 'pointer', fontSize: 11,
                  }}
                >
                  <span style={{ fontSize: 8, color: '#1e3a5f', display: 'block' }}>FS #{idx + 1}</span>
                  {fl.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ flexShrink: 0, padding: '8px', borderTop: '1px solid rgba(30,58,95,0.3)' }}>
        <button
          onClick={onNewLevel}
          style={{
            width: '100%', padding: '7px', fontSize: 12,
            background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.25)',
            color: '#00ff88', borderRadius: 7, cursor: 'pointer', letterSpacing: '0.04em',
          }}
        >
          {t('common.new_level')}
        </button>
      </div>
    </div>
  );
}
