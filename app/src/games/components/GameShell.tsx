'use client';

import { useMemo } from 'react';
import type { LevelData } from '../types';
import { useGameEngine } from '../hooks/useGameEngine';
import { computePoweredCells } from '../logic/powerSystem';
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative' }}>
        <HUD
          levelName={state.level.name}
          moveCount={state.moveCount}
          objects={state.objects}
          onRestart={restart}
        />
        <div style={{ position: 'relative' }}>
          <GameBoard
            level={state.level}
            objects={state.objects}
            boxes={state.boxes}
            trail={state.trail}
            poweredPlayers={state.poweredPlayers}
            poweredCells={poweredCells}
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

      {/* D-pad for mobile / touch */}
      <DPad onMove={move} />

      <p
        style={{
          marginTop: 6,
          fontSize: 10,
          color: '#1e3a5f',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        Arrow keys or tap controls to move
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
