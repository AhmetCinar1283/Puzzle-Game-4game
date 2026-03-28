'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { LevelData } from '@/app/src/games/types';
import type { StoredLevel } from '@/app/src/lib/db';
import GameShell from '@/app/src/games/components/GameShell';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function storedToLevelData(stored: StoredLevel & { id: number }): LevelData {
  return {
    id: stored.id,
    name: stored.name,
    width: stored.width,
    height: stored.height,
    edges: stored.edges,
    grid: stored.grid,
    initialObjects: stored.initialObjects,
    targets: stored.targets,
    trailCollision: stored.trailCollision,
  };
}

// ─── Inner component (needs useSearchParams → must be in Suspense) ────────────

function GameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idParam = searchParams.get('id');
  const levelId = idParam ? Number(idParam) : null;

  const [level, setLevel] = useState<LevelData | null>(null);
  const [nextLevelId, setNextLevelId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (levelId === null) {
      // No id param → go to levels list
      router.replace('/levels');
      return;
    }

    let cancelled = false;
    async function load() {
      const { getDB, getNextLevelId } = await import('@/app/src/lib/db');
      const db = getDB();
      const stored = await db.levels.get(levelId!);

      if (cancelled) return;
      if (!stored) {
        setError(true);
        setLoading(false);
        return;
      }

      setLevel(storedToLevelData(stored as StoredLevel & { id: number }));
      const next = await getNextLevelId(levelId!);
      if (!cancelled) {
        setNextLevelId(next);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [levelId, router]);

  const handleNextLevel = useCallback(() => {
    if (nextLevelId !== null) router.push(`/game?id=${nextLevelId}`);
  }, [nextLevelId, router]);

  if (loading) return <LoadingScreen />;
  if (error || !level) return <ErrorScreen onBack={() => router.push('/levels')} />;

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#030712',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 8px',
        boxSizing: 'border-box',
      }}
    >
      {/* Back link */}
      <button
        onClick={() => router.push('/levels')}
        style={{
          position: 'fixed',
          top: 12,
          left: 16,
          background: 'none',
          border: 'none',
          color: '#1e3a5f',
          fontSize: 12,
          cursor: 'pointer',
          letterSpacing: '0.06em',
          zIndex: 30,
        }}
      >
        ← Levels
      </button>

      <GameShell
        level={level}
        onNextLevel={nextLevelId !== null ? handleNextLevel : undefined}
      />
    </main>
  );
}

// ─── Loading / Error ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#030712',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em' }}>LOADING...</span>
    </main>
  );
}

function ErrorScreen({ onBack }: { onBack: () => void }) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#030712',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <span style={{ color: '#ef4444', fontSize: 14 }}>Level not found.</span>
      <button
        onClick={onBack}
        style={{
          padding: '8px 20px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.4)',
          color: '#ef4444',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        ← Back to Levels
      </button>
    </main>
  );
}

// ─── Page export ─────────────────────────────────────────────────────────────

export default function GamePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GameContent />
    </Suspense>
  );
}
