'use client';

import { useReducer, useEffect, useCallback, useRef } from 'react';
import type { LevelData, Direction } from '../types';
import { gameReducer, initialStateFromLevel } from '../logic/gameReducer';

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export function useGameEngine(initialLevel: LevelData) {
  const [state, dispatch] = useReducer(gameReducer, initialLevel, initialStateFromLevel);
  const movesHistoryRef = useRef<Direction[]>([]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      const direction = KEY_TO_DIRECTION[e.key];
      if (!direction) return;
      e.preventDefault();
      movesHistoryRef.current.push(direction);
      dispatch({ type: 'MOVE', direction });
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const restart = useCallback(() => {
    movesHistoryRef.current = [];
    dispatch({ type: 'RESTART' });
  }, []);

  const loadLevel = useCallback((level: LevelData) => {
    movesHistoryRef.current = [];
    dispatch({ type: 'LOAD_LEVEL', level });
  }, []);

  const move = useCallback((direction: Direction) => {
    movesHistoryRef.current.push(direction);
    dispatch({ type: 'MOVE', direction });
  }, []);

  return { state, dispatch, restart, loadLevel, move, movesHistoryRef };
}
