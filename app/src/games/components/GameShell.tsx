'use client';

import { useCallback } from 'react';
import type { LevelData } from '../types';
import { useGameEngine } from '../hooks/useGameEngine';
import { LEVELS } from '../levels';
import GameBoard from './GameBoard';
import HUD from './HUD';
import WinOverlay from './WinOverlay';
import LostOverlay from './LostOverlay';

interface GameShellProps {
  level: LevelData;
}

export default function GameShell({ level }: GameShellProps) {
  const { state, restart, loadLevel } = useGameEngine(level);

  const currentLevelIndex = LEVELS.findIndex((l) => l.id === state.level.id);
  const nextLevel = LEVELS[currentLevelIndex + 1];

  const handleNextLevel = useCallback(() => {
    if (nextLevel) loadLevel(nextLevel);
  }, [nextLevel, loadLevel]);

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
          <GameBoard level={state.level} objects={state.objects} trail={state.trail} />
          {state.phase === 'won' && (
            <WinOverlay
              moveCount={state.moveCount}
              onRestart={restart}
              onNextLevel={nextLevel ? handleNextLevel : undefined}
            />
          )}
          {state.phase === 'lost' && (
            <LostOverlay onRestart={restart} reason={state.lostReason} />
          )}
        </div>
      </div>
      <p
        style={{
          marginTop: 12,
          fontSize: 11,
          color: '#334155',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Arrow keys to move
      </p>
    </div>
  );
}
