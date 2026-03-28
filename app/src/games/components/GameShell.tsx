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
    <div className="flex flex-col items-center">
      <div className="relative">
        <HUD
          levelName={state.level.name}
          moveCount={state.moveCount}
          objects={state.objects}
          onRestart={restart}
        />
        <div className="relative">
          <GameBoard level={state.level} objects={state.objects} trail={state.trail} />
          {state.phase === 'won' && (
            <WinOverlay
              moveCount={state.moveCount}
              onRestart={restart}
              onNextLevel={nextLevel ? handleNextLevel : undefined}
            />
          )}
          {state.phase === 'lost' && <LostOverlay onRestart={restart} />}
        </div>
      </div>
      <p className="mt-4 text-slate-500 text-xs">Use arrow keys to move</p>
    </div>
  );
}
