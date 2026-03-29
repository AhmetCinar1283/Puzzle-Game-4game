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

interface GameShellProps {
  level: LevelData;
  /** Called when the player requests the next level. Omit to hide the button. */
  onNextLevel?: () => void;
}

export default function GameShell({ level, onNextLevel }: GameShellProps) {
  const { state, restart, move } = useGameEngine(level);
  const { play, muted, toggleMute } = useSoundManager();

  // ── Ses tetikleyicileri ────────────────────────────────────────────────────
  const prevStateRef = useRef<GameState | null>(null);
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    if (!prev) return;

    // Kazanma / kaybetme
    if (state.phase === 'won' && prev.phase !== 'won') { play('win'); return; }
    if (state.phase === 'lost' && prev.phase !== 'lost') { play('lose'); return; }

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
          style={{ position: 'relative' }}
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
          />
          {state.phase === 'won' && (
            <WinOverlay
              moveCount={state.moveCount}
              onRestart={restart}
              onNextLevel={onNextLevel}
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
