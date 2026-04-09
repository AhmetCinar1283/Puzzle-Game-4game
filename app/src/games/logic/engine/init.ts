import type { GameState } from '../../types';
import type { CellState, TickState, TickEntity } from './types';
import { entityKey } from './types';
import { computePoweredCells } from '../powerSystem';
import { playerBehavior } from './entities/player';
import { boxBehavior } from './entities/box';

export function initTickState(state: GameState): TickState {
  const poweredCells = computePoweredCells(
    state.level.grid,
    state.level,
    state.poweredPlayers,
    state.trail,
    state.boxes,
  );

  const entities: TickEntity[] = [
    ...state.objects.map(
      (obj): TickEntity => ({
        kind: 'player',
        id: obj.id,
        position: { ...obj.position },
        velocity: null,
        behavior: playerBehavior,
        mode: obj.mode,
        lockOnTarget: obj.lockOnTarget,
        isLocked: obj.isLocked,
        z: 0,
      }),
    ),
    ...state.boxes.map(
      (box): TickEntity => ({
        kind: 'box',
        id: box.id,
        position: { ...box.position },
        velocity: null,
        behavior: boxBehavior,
        requiresPower: box.requiresPower,
        z: 0,
      }),
    ),
  ];

  // Waypoints start at each entity's starting position with z=0.
  const animationPaths: Record<string, { row: number; col: number; z: number }[]> = {};
  for (const e of entities) {
    animationPaths[entityKey(e)] = [{ ...e.position, z: 0 }];
  }

  // Build active CellState grid from the level's static type grid.
  // occupantIds starts empty; we populate it from entity positions below.
  const grid: CellState[][] = state.level.grid.map((row) =>
    row.map((type) => ({ type, occupantIds: [] })),
  );
  for (const e of entities) {
    grid[e.position.row]?.[e.position.col]?.occupantIds.push(e.id);
  }

  return {
    level: state.level,
    grid,
    poweredCells,
    entities,
    trail: { ...state.trail },
    poweredPlayers: [...state.poweredPlayers],
    animationPaths,
    conveyorRemainingUses: { ...(state.conveyorRemainingUses ?? {}) },
    didWin: false,
  };
}
