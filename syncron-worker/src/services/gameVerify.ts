import type { Cell } from '../../../app/src/game2/logic/cellTypes';
import type { Entity } from '../../../app/src/game2/logic/entityTypes';
import type { Direction, ActionIntent } from '../../../app/src/game2/logic/types';
import type { LevelBounds } from '../../../app/src/game2/logic/engine/getNextTopologyPosition';
import { processSingleTick } from '../../../app/src/game2/logic/engine/intentLoop';
import { checkWinCondition } from '../../../app/src/game2/logic/winCondition';
import { convertToGame2State } from '../../../app/src/game2/logic/converter';

// We map both short-hand and long-form directions to Direction, plus 's' to switch_room
const MOVES_MAP: Record<string, Direction | 'switch_room'> = {
  u: 'up',
  d: 'down',
  l: 'left',
  r: 'right',
  s: 'switch_room',
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
  // 1. Validate all directions/actions are supported before starting
  for (const m of moves) {
    if (!MOVES_MAP[m]) return false;
  }

  // 2. Convert raw level record to game2 state representation using the shared converter
  const { entities: initialEntities, rooms, controlMode, initialControlledRooms } = convertToGame2State(level);
  let entities = initialEntities;
  let currentControlledRoomIds = [...initialControlledRooms];

  const mainRoom = rooms['main'];

  // 3. Compute level topology boundaries (default edges to walls if undefined, matching frontend)
  const levelBounds: LevelBounds = {
    rooms: Object.entries(rooms).reduce((acc, [rId, room]) => {
      acc[rId] = { rows: room.height, cols: room.width, edges: room.edges };
      return acc;
    }, {} as Record<string, { rows: number; cols: number; edges: any }>),
    rows: mainRoom?.height ?? level.height ?? 0,
    cols: mainRoom?.width ?? level.width ?? 0,
    edges: mainRoom?.edges ?? level.edges ?? { top: 'wall', bottom: 'wall', left: 'wall', right: 'wall' },
    trailCollision: !!level.trailCollision,
  };

  // 4. Replay player moves step by step
  for (const moveChar of moves) {
    const action = MOVES_MAP[moveChar];

    // Handle manual room switching
    if (action === 'switch_room') {
      const roomKeys = Object.keys(rooms);
      if (roomKeys.length > 1) {
        const currentIdx = roomKeys.indexOf(currentControlledRoomIds[0] ?? '');
        const nextIdx = (currentIdx + 1) % roomKeys.length;
        currentControlledRoomIds = [roomKeys[nextIdx]];
      }
      continue;
    }

    const rawDirection = action;

    // Generate initial intents for active player entities
    const intents: ActionIntent[] = entities
      .filter(ent => ent.type === 'player' && !ent.customData.isLocked)
      .filter(ent => {
        const entRoomId = ent.position.roomId ?? 'main';
        if (controlMode === 'selected_room') {
          return currentControlledRoomIds.includes(entRoomId);
        }
        return true;
      })
      .map(ent => {
        const mode = (ent.customData.mode as string) ?? 'normal';
        let direction = mode === 'reversed'
          ? OPPOSITE_DIRECTION[rawDirection]
          : rawDirection;

        if (ent.customData.controlMapping) {
          const mapping = ent.customData.controlMapping as Record<Direction, Direction>;
          direction = mapping[direction] ?? direction;
        }

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
        rooms,
        pending,
        levelBounds,
      );

      tickNumber++;

      // Process change_control UI events exactly like useGameEngine
      for (const uiEv of result.uiEvents) {
        if (uiEv.kind === 'change_control') {
          const { action: uiAction, targetRooms } = uiEv;
          let nextIds = [...currentControlledRoomIds];
          if (uiAction === 'set') {
            nextIds = targetRooms;
          } else if (uiAction === 'add') {
            nextIds = Array.from(new Set([...nextIds, ...targetRooms]));
          } else if (uiAction === 'remove') {
            nextIds = nextIds.filter((id) => !targetRooms.includes(id));
          } else if (uiAction === 'toggle') {
            for (const tr of targetRooms) {
              if (nextIds.includes(tr)) {
                nextIds = nextIds.filter((id) => id !== tr);
              } else {
                nextIds.push(tr);
              }
            }
          } else if (uiAction === 'cycle') {
            const roomKeys = Object.keys(rooms);
            if (roomKeys.length > 0) {
              const currentIdx = roomKeys.indexOf(nextIds[0] ?? '');
              const nextIdx = (currentIdx + 1) % roomKeys.length;
              nextIds = [roomKeys[nextIdx]];
            }
          }
          currentControlledRoomIds = nextIds;
        }
      }

      // Filter out destroyed entities from the active entity pool
      entities = entities.filter(e => !e.customData._destroyed);

      const playerCountAfter = entities.filter(e => e.type === 'player').length;
      const playerDestroyed = playerCountAfter < playerCountBefore;

      const isWin = checkWinCondition(entities, rooms);

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
  return checkWinCondition(entities, rooms);
}
