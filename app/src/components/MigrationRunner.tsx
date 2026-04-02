'use client';

import { useState } from 'react';
import { migratePresetsToFirestore } from '../lib/firebase/migrate';
import { useAuth } from '../hooks/useAuth';

/**
 * Admin-only UI for one-time preset level migration to Firestore.
 * Visible only to users with role === 'admin'.
 * Place anywhere in the admin UI (e.g. editor page or a dedicated /admin page).
 */
export default function MigrationRunner() {
  const { user, role } = useAuth();
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (role !== 'admin') return null;

  async function handleMigrate() {
    if (!user) return;
    setStatus('running');
    setProgress(null);
    setErrorMsg('');
    try {
      await migratePresetsToFirestore(user.uid, (done, total) =>
        setProgress({ done, total }),
      );
      setStatus('done');
    } catch (err) {
      console.error('[MigrationRunner]', err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  return (
    <div
      style={{
        padding: '12px 16px',
        border: '1px solid rgba(251,191,36,0.3)',
        borderRadius: 8,
        background: 'rgba(251,191,36,0.04)',
        marginTop: 16,
      }}
    >
      <div style={{ color: '#fbbf24', fontSize: 11, letterSpacing: '0.08em', marginBottom: 8 }}>
        ONE-TIME MIGRATION
      </div>
      <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
        Upload preset-levels.json to Firestore as Part 1.
        Safe to run once; subsequent runs are no-ops.
      </div>

      {status === 'idle' && (
        <button
          onClick={handleMigrate}
          style={{
            padding: '6px 16px',
            background: 'rgba(251,191,36,0.12)',
            border: '1px solid rgba(251,191,36,0.5)',
            color: '#fbbf24',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Run Migration
        </button>
      )}

      {status === 'running' && progress && (
        <div style={{ color: '#fbbf24', fontSize: 12 }}>
          Uploading… {progress.done} / {progress.total}
        </div>
      )}

      {status === 'done' && (
        <div style={{ color: '#00ff88', fontSize: 12 }}>Migration complete.</div>
      )}

      {status === 'error' && (
        <div style={{ color: '#ef4444', fontSize: 12 }}>Error: {errorMsg}</div>
      )}
    </div>
  );
}
