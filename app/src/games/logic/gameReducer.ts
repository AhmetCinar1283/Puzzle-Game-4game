import type { GameState, GameAction, LevelData, GameObjectState, BoxState } from '../types';
import { processMoveStep } from './movement';

export function initialStateFromLevel(level: LevelData): GameState {
  const objects: GameObjectState[] = level.initialObjects.map((def) => ({
    id: def.id,
    position: def.position,
    mode: def.mode,
    lockOnTarget: def.lockOnTarget,
    isLocked: false,
  }));

  const boxes: BoxState[] = (level.initialBoxes ?? []).map((def) => ({
    id: def.id,
    position: def.position,
    requiresPower: def.requiresPower ?? false,
  }));

  return {
    level,
    objects,
    boxes,
    poweredPlayers: [],
    phase: 'playing',
    moveCount: 0,
    trail: {},
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MOVE':
      return processMoveStep(state, action.direction);
    case 'RESTART':
      return initialStateFromLevel(state.level);
    case 'LOAD_LEVEL':
      return initialStateFromLevel(action.level);
  }
}
