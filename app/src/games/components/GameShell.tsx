'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import type { LevelData, GameState } from '../types';
import { useGameEngine } from '../hooks/useGameEngine';
import { computePoweredCells } from '../logic/powerSystem';
import { useSoundManager } from '../hooks/useSoundManager';
import GameBoard from './GameBoard';
import HUD from './HUD';
import WinOverlay from './WinOverlay';
import LostOverlay from './LostOverlay';
import { trackLevelStart, trackLevelComplete, trackLevelFail } from '../../lib/analytics';
import { useAuthContext } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useGamepad } from '@/app/src/hooks/useGamepad';

interface GameShellProps {
  level: LevelData;
  /** Called when the player requests the next level. Omit to hide the button. */
  onNextLevel?: () => void;
  /** Whether this is a preset (campaign) or user-created level — used for analytics. */
  source?: 'preset' | 'user';
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;
const MOVES_LIMIT = 500;

interface WorkerResult {
  stars: 1 | 2 | 3;
  scoreDelta: number;
  isFirstCompletion: boolean;
  isNewBestSolution: boolean;
  isBestSolution: boolean;
  isGoodSolution: boolean;
}

export default function GameShell({ level, onNextLevel, source }: GameShellProps) {
  const { state, restart, move, movesHistoryRef } = useGameEngine(level);
  const { play, muted, toggleMute } = useSoundManager();
  const { user } = useAuthContext();
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const router = useRouter();

  const [workerResult, setWorkerResult] = useState<WorkerResult | null>(null);

  // Gamepad controller support
  useGamepad({
    onMove: (dir) => {
      if (state.phase === 'won' || state.phase === 'lost') return;
      move(dir);
    },
    onRestart: () => {
      restart();
    },
    onMenu: () => {
      router.push('/levels');
    },
  });

  // Keyboard shortcuts (R for restart, Escape for menu)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        restart();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        router.push('/levels');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [restart, router]);

  // ── Analytics: level start ────────────────────────────────────────────────
  const startTimeRef = useRef(Date.now());
  useEffect(() => {
    trackLevelStart(level.id, level.name, source ?? 'user');
    startTimeRef.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Ses tetikleyicileri ────────────────────────────────────────────────────
  const prevStateRef = useRef<GameState | null>(null);
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    if (!prev) return;

    // Kazanma / kaybetme
    if (state.phase === 'won' && prev.phase !== 'won') {
      play('win');
      const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
      trackLevelComplete(state.level.id, state.level.name, state.moveCount, timeSpent);

      // Report completion to worker for verified scoring
      if (WORKER_URL && state.level.firestoreId && userRef.current) {
        const firestoreId = state.level.firestoreId;
        const moves = [...movesHistoryRef.current];
        void (async () => {
          try {
            if (moves.length === 0 || moves.length > MOVES_LIMIT) return;

            // ── Optimistic write: record in Dexie immediately ─────────────────
            // This gives instant feedback in the levels list while we wait for
            // the Worker to verify the solution. If the Worker fails, the
            // provisional record stays and D1 will correct it on next sync.
            const { getDB } = await import('@/app/src/lib/db');
            const db = getDB();
            const existing = await db.playedLevels.get(firestoreId);
            const provisionalStars = (existing?.stars ?? 0) === 3 ? 3 : 1; // conservative estimate
            await db.playedLevels.put({
              levelId: firestoreId,
              score: provisionalStars,
              timeSpent,
              completedAt: existing?.completedAt ?? Date.now(),
              updatedAt: Date.now(),
              stars: provisionalStars as 1 | 2 | 3,
              moveCount: moves.length,
            });

            const token = await userRef.current!.getIdToken();
            const res = await fetch(`${WORKER_URL}/complete-level`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ levelId: firestoreId, moves, timeSpent }),
            });
            if (!res.ok) {
              console.error('[Worker] HTTP error:', res.status, await res.text());
              // Provisional Dexie record stays — D1 sync will correct on next open
              return;
            }

            const data = await res.json() as { success: boolean } & WorkerResult;
            console.log('[Worker] Response:', data);
            if (!data.success) return;

            // ── Overwrite with server-verified result ─────────────────────────
            await db.playedLevels.put({
              levelId: firestoreId,
              score: data.stars,
              timeSpent,
              completedAt: existing?.completedAt ?? Date.now(),
              updatedAt: Date.now(),
              stars: data.stars,
              moveCount: moves.length,
            });

            setWorkerResult({
              stars: data.stars,
              scoreDelta: data.scoreDelta,
              isFirstCompletion: data.isFirstCompletion,
              isNewBestSolution: data.isNewBestSolution,
              isBestSolution: data.isBestSolution,
              isGoodSolution: data.isGoodSolution,
            });
          } catch (e) {
            console.error('[Worker] Fetch error:', e);
            // Provisional Dexie record stays if written — D1 sync will reconcile
          }
        })();
      }

      return;
    }
    if (state.phase === 'lost' && prev.phase !== 'lost') {
      play('lose');
      const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
      trackLevelFail(state.level.id, state.level.name, state.moveCount, state.lostReason ?? 'unknown', timeSpent);
      return;
    }

    // Hareket yoksa ses yok
    if (state.moveCount === prev.moveCount) return;

    // Yön değiştirme (direction_toggle hücresi)
    const modeChanged = state.objects.some((obj, i) => obj.mode !== prev.objects[i]?.mode);
    if (modeChanged) play('toggle');

    // Kutu itme
    const boxMoved = state.boxes.some((box) => {
      const pb = prev.boxes.find((b) => b.id === box.id);
      return pb && (pb.position.row !== box.position.row || pb.position.col !== box.position.col);
    });
    if (boxMoved) play('box_push');

    // Hareket sesleri (en "ilginç" tip önce)
    const types = Object.values(state.moveAnimTypes ?? {});
    if (types.includes('teleport'))  { play('teleport'); return; }
    if (types.includes('portal'))    { play('portal');   return; }
    if (types.includes('ice'))       { play('ice');      return; }
    if (types.includes('conveyor'))  { play('conveyor'); return; }

    // Normal hareket (en az bir nesne pozisyon değiştirdiyse)
    const anyMoved = state.objects.some((obj, i) => {
      const po = prev.objects[i];
      return po && (po.position.row !== obj.position.row || po.position.col !== obj.position.col);
    });
    if (anyMoved) play('move');
  }, [state, play]);

  const poweredCells = useMemo(
    () =>
      computePoweredCells(
        state.level.grid,
        state.level,
        state.poweredPlayers,
        state.trail,
        state.boxes,
      ),
    [state.level, state.poweredPlayers, state.trail, state.boxes],
  );

  // ── Dynamic cell size based on viewport ──────────────────────────────────
  const [cellSize, setCellSize] = useState(72);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function compute() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const availW = vw - 32;
      const isMob = vw < 768;
      // On mobile: reserve space for HUD (~60px) + hint (~32px) + padding
      // On desktop: reserve space for HUD (~60px) + D-pad (~200px) + hint (~32px) + padding
      const availH = vh - (isMob ? 110 : 310);
      const cs = Math.max(32, Math.min(72,
        Math.floor(availW / level.width),
        Math.floor(availH / level.height),
      ));
      setCellSize(cs);
      setIsMobile(isMob);
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [level.width, level.height]);

  // ── Swipe detection ───────────────────────────────────────────────────────
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;
    if (Math.abs(dx) >= Math.abs(dy)) {
      move(dx > 0 ? 'right' : 'left');
    } else {
      move(dy > 0 ? 'down' : 'up');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative' }}>
        <HUD
          levelName={state.level.name}
          moveCount={state.moveCount}
          objects={state.objects}
          onRestart={restart}
          muted={muted}
          onToggleMute={toggleMute}
        />
        <div
          style={{ position: 'relative', touchAction: 'none' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <GameBoard
            level={state.level}
            objects={state.objects}
            boxes={state.boxes}
            trail={state.trail}
            poweredPlayers={state.poweredPlayers}
            poweredCells={poweredCells}
            cellSize={cellSize}
            moveAnimTypes={state.moveAnimTypes}
            animationPaths={state.animationPaths}
          />
          {state.phase === 'won' && (
            <WinOverlay
              moveCount={state.moveCount}
              onRestart={restart}
              onNextLevel={onNextLevel}
              workerResult={workerResult}
            />
          )}
          {state.phase === 'lost' && (
            <LostOverlay onRestart={restart} reason={state.lostReason} />
          )}
        </div>
      </div>

      {/* D-pad only on desktop; on mobile swipe is used */}
      {!isMobile && <DPad onMove={move} />}

      <p
        style={{
          marginTop: 6,
          fontSize: 10,
          color: '#1e3a5f',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {isMobile ? 'Swipe to move' : 'Arrow keys or tap controls to move'}
      </p>
    </div>
  );
}

// ─── D-Pad ────────────────────────────────────────────────────────────────────

import type { Direction } from '../types';

function DPad({ onMove }: { onMove: (dir: Direction) => void }) {
  const btn = (dir: Direction, label: string) => (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onMove(dir);
      }}
      style={{
        width: 52,
        height: 52,
        fontSize: 20,
        background: 'rgba(0,196,255,0.06)',
        border: '1px solid rgba(0,196,255,0.25)',
        color: '#00c4ff',
        borderRadius: 10,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        transition: 'all 0.1s',
        boxShadow: '0 0 8px rgba(0,196,255,0.1)',
      }}
      onPointerEnter={(e) => {
        if (e.buttons > 0) return;
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,196,255,0.14)';
      }}
      onPointerLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,196,255,0.06)';
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        marginTop: 14,
        display: 'grid',
        gridTemplateColumns: '52px 52px 52px',
        gridTemplateRows: '52px 52px 52px',
        gap: 4,
      }}
    >
      <div />
      {btn('up', '↑')}
      <div />
      {btn('left', '←')}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      />
      {btn('right', '→')}
      <div />
      {btn('down', '↓')}
      <div />
    </div>
  );
}
