'use client';

import type { StoredLevel } from '@/app/src/lib/db';
import type { FirestoreLevel } from '@/app/src/lib/firebase/admin';

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
  return (
    <div style={{
      width: isMobile ? '100%' : 170, flexShrink: 0,
      borderRight: isMobile ? 'none' : '1px solid rgba(30,58,95,0.4)',
      display: isMobile ? (visible ? 'flex' : 'none') : 'flex',
      flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ flexShrink: 0, padding: '10px 12px 6px', borderBottom: '1px solid rgba(30,58,95,0.3)' }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#1e3a5f' }}>Saved Levels</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {levelsLoading ? (
          <span style={{ fontSize: 11, color: '#1e3a5f' }}>Loading...</span>
        ) : savedLevels.length === 0 ? (
          <span style={{ fontSize: 11, color: '#1e3a5f', lineHeight: 1.5, display: 'block', padding: '8px 4px' }}>
            No saved levels yet. Click Save to store your first level.
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
            {showFirestoreLevels ? '▼' : '▶'} Firestore
          </button>
          {showFirestoreLevels && (
            <div style={{ marginTop: 4 }}>
              {firestoreLevels.length === 0 ? (
                <span style={{ fontSize: 10, color: '#334155', padding: '4px 2px', display: 'block' }}>
                  No levels in Part {selectedPartId}
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
          + New Level
        </button>
      </div>
    </div>
  );
}
