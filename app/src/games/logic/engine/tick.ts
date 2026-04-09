import type { GameState, Direction } from '../../types';
import { initTickState } from './init';
import { assignInitialVelocities } from './velocities';
import { runTickLoop } from './loop';
import { finalizeTickState } from './finalize';

export function processMoveStep(state: GameState, direction: Direction): GameState {
  if (state.phase === 'won' || state.phase === 'lost') return state;

  const tick = initTickState(state);
  assignInitialVelocities(tick, direction);
  if (!tick.lostReason) runTickLoop(tick);
  return finalizeTickState(tick, state);
}
