import type { Cell, CellTypes } from '../../../app/src/game2/logic/cellTypes';
import type { Entity } from '../../../app/src/game2/logic/entityTypes';
import type { Direction, ActionIntent, EntityTrait } from '../../../app/src/game2/logic/types';
import type { LevelBounds } from '../../../app/src/game2/logic/engine/getNextTopologyPosition';
import { CELL_DEFS } from '../../../app/src/game2/logic/cells/registry';
import { processSingleTick } from '../../../app/src/game2/logic/engine/intentLoop';
import { checkWinCondition } from '../../../app/src/game2/logic/winCondition';

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

  // 2. Convert raw level record to game2 state representation
  const { entities: initialEntities, grid } = convertToGame2State(level);
  let entities = initialEntities;

  // 3. Compute level topology boundaries
  const levelBounds: LevelBounds | undefined = level.edges ? {
    rows: grid.length,
    cols: grid[0]?.length ?? 0,
    edges: level.edges,
    trailCollision: !!level.trailCollision,
  } : undefined;

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

/**
 * Maps old cell type string representation to game2 schema types and custom data.
 */
function mapCellType(old: string): { type: CellTypes; customData?: Record<string, any> } {
  switch (old) {
    case 'empty':            return { type: 'normal' };
    case 'obstacle':         return { type: 'obstacle' };
    case 'forbidden':        return { type: 'forbidden' };
    case 'ice':              return { type: 'ice' };
    case 'power_node':       return { type: 'power' };
    case 'direction_toggle': return { type: 'toggle' };
    case 'target_1':         return { type: 'target',    customData: { playerIndex: 0 } };
    case 'target_2':         return { type: 'target',    customData: { playerIndex: 1 } };
    case 'conveyor_up':      return { type: 'conveyor',  customData: { direction: 'up' } };
    case 'conveyor_down':    return { type: 'conveyor',  customData: { direction: 'down' } };
    case 'conveyor_left':    return { type: 'conveyor',  customData: { direction: 'left' } };
    case 'conveyor_right':   return { type: 'conveyor',  customData: { direction: 'right' } };
    case 'trampoline_up':    return { type: 'trampoline', customData: { direction: 'up' } };
    case 'trampoline_down':  return { type: 'trampoline', customData: { direction: 'down' } };
    case 'trampoline_left':  return { type: 'trampoline', customData: { direction: 'left' } };
    case 'trampoline_right': return { type: 'trampoline', customData: { direction: 'right' } };
    case 'teleporter_in_A':  return { type: 'teleport', customData: { group: 'A', isIn: true  } };
    case 'teleporter_out_A': return { type: 'teleport', customData: { group: 'A', isIn: false } };
    case 'teleporter_in_B':  return { type: 'teleport', customData: { group: 'B', isIn: true  } };
    case 'teleporter_out_B': return { type: 'teleport', customData: { group: 'B', isIn: false } };
    case 'teleporter_in_C':  return { type: 'teleport', customData: { group: 'C', isIn: true  } };
    case 'teleporter_out_C': return { type: 'teleport', customData: { group: 'C', isIn: false } };
    default:                 return { type: 'normal' };
  }
}

/**
 * Pure function to map raw StoredLevel document to game2 Entity[] and Cell[][] grids.
 */
function convertToGame2State(level: any): { entities: Entity[]; grid: Cell[][] } {
  const rawGrid = level.grid;

  // 1. Map cells
  const grid: Cell[][] = rawGrid.map((row: any[], rowIdx: number) =>
    row.map((oldType: any, colIdx: number) => {
      const { type, customData = {} } = mapCellType(oldType);
      return {
        id: `${rowIdx}-${colIdx}`,
        type,
        position: { row: rowIdx, col: colIdx },
        def: { ...CELL_DEFS[type] },
        isElectrified: false,
        customData,
      };
    })
  );

  // 2. Link teleporters
  const teleporters = grid.flat().filter(c => c.type === 'teleport');
  for (const inCell of teleporters.filter(c => c.customData.isIn === true)) {
    const group = inCell.customData.group as string;
    const outCell = teleporters.find(c => c.customData.group === group && c.customData.isIn === false);
    if (outCell) {
      inCell.customData.exitPos = { ...outCell.position };
      outCell.customData.entrancePos = { ...inCell.position };
    }
  }

  // 3. Create entities
  let nextId = 1;
  const entities: Entity[] = [];

  // Players
  for (let i = 0; i < level.initialObjects.length; i++) {
    const obj = level.initialObjects[i];
    const isLocked = !!obj.lockOnTarget &&
      grid[obj.position.row]?.[obj.position.col]?.type === 'target' &&
      (grid[obj.position.row]?.[obj.position.col]?.customData.playerIndex as number) === i;
    entities.push({
      id: nextId++,
      type: 'player',
      position: { ...obj.position },
      physics: { direction: 'right', force: 0, z: 0 },
      def: { mass: 1, resistance: 0, isSolid: true },
      traits: new Set(['player_controlled', 'destructible'] as EntityTrait[]),
      isElectrified: false,
      customData: {
        playerIndex: i,
        mode: obj.mode ?? 'normal',
        lockOnTarget: obj.lockOnTarget ?? true,
        isLocked,
      },
    });
  }

  // Boxes
  for (const box of level.initialBoxes ?? []) {
    entities.push({
      id: nextId++,
      type: 'box',
      position: { ...box.position },
      physics: { direction: 'right', force: 0, z: 0 },
      def: { mass: 2, resistance: 1, isSolid: true },
      traits: new Set(['pushable', 'destructible'] as EntityTrait[]),
      isElectrified: false,
      customData: {
        requiresPower: box.requiresPower ?? false,
      },
    });
  }

  return { entities, grid };
}
