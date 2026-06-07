import type { Cell } from '../../../app/src/game2/logic/cellTypes';
import type { Entity } from '../../../app/src/game2/logic/entityTypes';
import type { Direction, ActionIntent } from '../../../app/src/game2/logic/types';
import type { LevelBounds } from '../../../app/src/game2/logic/engine/getNextTopologyPosition';
import { processSingleTick } from '../../../app/src/game2/logic/engine/intentLoop';
import { checkWinCondition } from '../../../app/src/game2/logic/winCondition';
import { convertToGame2State } from '../../../app/src/game2/logic/converter';

// We map both short-hand and long-form directions to Direction
const MOVES_MAP: Record<string, Direction> = {
  u: 'up',
  d: 'down',
  l: 'left',
  r: 'right',
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
};

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/**
 * Replay a move sequence on the given level and return true if the result is a win.
 * Returns false for invalid moves or if the game is lost/not won after all moves.
 */
export function verifyMoves(level: any, moves: string[]): boolean {
  // 1. Validate all directions are supported before starting
  for (const m of moves) {
    if (!MOVES_MAP[m]) return false;
  }

  // 2. Convert raw level record to game2 state representation using the shared converter
  const { entities: initialEntities, grid } = convertToGame2State(level);
  let entities = initialEntities;

  // 3. Compute level topology boundaries (default edges to walls if undefined, matching frontend)
  const levelBounds: LevelBounds = {
    rows: grid.length,
    cols: grid[0]?.length ?? 0,
    edges: level.edges ?? { top: 'wall', bottom: 'wall', left: 'wall', right: 'wall' },
    trailCollision: !!level.trailCollision,
  };

  // 4. Replay player moves step by step
  for (const moveChar of moves) {
    const rawDirection = MOVES_MAP[moveChar];

    // Generate initial intents for active player entities
    const intents: ActionIntent[] = entities
      .filter(ent => ent.type === 'player' && !ent.customData.isLocked)
      .map(ent => {
        const mode = (ent.customData.mode as string) ?? 'normal';
        const direction = mode === 'reversed'
          ? OPPOSITE_DIRECTION[rawDirection]
          : rawDirection;
        return {
          entityId: ent.id,
          type: 'mutate_entity' as const,
          newDirection: direction,
          newForce: 1,
        };
      });

    if (intents.length === 0) return false;

    // Simulate tick engine for this turn until it settles (max 50 ticks)
    let pending = [...intents];
    let tickNumber = 0;
    let turnWon = false;
    let turnLost = false;

    while (tickNumber < 50) {
      // Check if there are active sliding or falling entities
      const hasActivePhysics = entities.some(e =>
        !e.customData._destroyed && (e.physics.force > 0 || e.physics.z > 0)
      );
      if (pending.length === 0 && !hasActivePhysics) break;

      const playerCountBefore = entities.filter(e => e.type === 'player').length;

      const result = processSingleTick(
        entities,
        grid,
        pending,
        levelBounds,
      );

      tickNumber++;

      // Filter out destroyed entities from the active entity pool
      entities = entities.filter(e => !e.customData._destroyed);

      const playerCountAfter = entities.filter(e => e.type === 'player').length;
      const playerDestroyed = playerCountAfter < playerCountBefore;

      const isWin = checkWinCondition(entities, grid);

      if (isWin) {
        turnWon = true;
        break;
      }

      if (playerDestroyed) {
        turnLost = true;
        break;
      }

      pending = result.pendingNextTick;
    }

    if (turnWon) return true;
    if (turnLost) return false;
  }

  // After executing all moves, check if the level is in a winning state
  return checkWinCondition(entities, grid);
}
