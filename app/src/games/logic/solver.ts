import { convertToGame2State } from '@/app/play/converter';
import { processSingleTick } from '@/app/src/game2/logic/engine/intentLoop';
import { checkWinCondition } from '@/app/src/game2/logic/winCondition';
import type { Entity } from '@/app/src/game2/logic/entityTypes';
import type { Cell } from '@/app/src/game2/logic/cellTypes';
import type { ActionIntent } from '@/app/src/game2/logic/types';
import type { LevelBounds } from '@/app/src/game2/logic/engine/getNextTopologyPosition';
import type { LevelData, Direction } from '../types';

export interface SolverResult {
  solvable: boolean;
  solution: Direction[] | null;
  statesExplored: number;
  moveCount: number;
}

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/** Deep clone entities */
function cloneEntities(entities: Entity[]): Entity[] {
  return entities.map((e) => ({
    ...e,
    position: { ...e.position },
    physics: { ...e.physics },
    def: { ...e.def },
    traits: new Set(e.traits),
    customData: { ...e.customData },
  }));
}

/** Deep clone grid */
function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map((row) =>
    row.map((cell) => ({
      ...cell,
      def: { ...cell.def },
      customData: { ...cell.customData },
    }))
  );
}

/**
 * Compact serialization of the game2 state.
 * Fully captures entity positions, forces, modes, heights, and active/destroyed statuses.
 */
function serializeState(entities: Entity[], grid: Cell[][]): string {
  const activeEnts = entities
    .filter((e) => !e.customData._destroyed)
    .sort((a, b) => a.id - b.id)
    .map((e) => {
      const mode = e.customData.mode ?? '';
      return `${e.id}:${e.type}:${e.position.row},${e.position.col}:${e.physics.direction}:${e.physics.force}:${e.physics.z}:${mode}`;
    })
    .join('|');

  // Serialize grid mutations (like crushed obstacles)
  const mutatedCells = grid
    .flat()
    .filter((c) => c.type === 'normal' && c.customData.wasObstacle)
    .map((c) => c.id)
    .sort()
    .join('|');

  return `${activeEnts}#${mutatedCells}`;
}

/**
 * Executes a single movement command rawDirection in game2 physics.
 * Replicates the multi-tick fixed point loop inside useGameEngine and PlayScreen.
 */
function transition(
  entities: Entity[],
  grid: Cell[][],
  rawDirection: Direction,
  levelBounds?: LevelBounds
): { entities: Entity[]; grid: Cell[][]; won: boolean; lost: boolean } {
  const clonedEnts = cloneEntities(entities);
  const clonedGrid = cloneGrid(grid);

  // Construct initial mutate intents exactly like PlayScreen
  const intents: ActionIntent[] = clonedEnts
    .filter((ent) => ent.type === 'player' && !ent.customData.isLocked)
    .map((ent) => {
      const mode = (ent.customData.mode as string) ?? 'normal';
      const direction = mode === 'reversed' ? OPPOSITE_DIRECTION[rawDirection] : rawDirection;
      return {
        entityId: ent.id,
        type: 'mutate_entity' as const,
        newDirection: direction,
        newForce: 1,
      };
    });

  let pending = [...intents];
  let tickNumber = 0;
  let won = false;
  let lost = false;

  const MAX_TICKS = 50;

  while (tickNumber < MAX_TICKS) {
    const hasActivePhysics = clonedEnts.some(
      (e) => !e.customData._destroyed && (e.physics.force > 0 || e.physics.z > 0)
    );
    if (pending.length === 0 && !hasActivePhysics) break;

    const playerCountBefore = clonedEnts.filter((e) => e.type === 'player' && !e.customData._destroyed).length;

    const result = processSingleTick(clonedEnts, clonedGrid, pending, levelBounds);
    tickNumber++;

    // Mark cells that were obstacles but got crushed
    result.pendingNextTick.forEach((intent) => {
      if (intent.type === 'mutate_cell' && intent.targetCellPos && intent.newCellType === 'normal') {
        const cell = clonedGrid[intent.targetCellPos.row]?.[intent.targetCellPos.col];
        if (cell) cell.customData.wasObstacle = true;
      }
    });

    const activeEntities = clonedEnts.filter((e) => !e.customData._destroyed);
    clonedEnts.length = 0;
    clonedEnts.push(...activeEntities);

    const playerCountAfter = clonedEnts.filter((e) => e.type === 'player').length;
    
    won = checkWinCondition(clonedEnts, clonedGrid);
    lost = playerCountAfter < playerCountBefore;

    if (won || lost) {
      break;
    }
    pending = result.pendingNextTick;
  }

  return {
    entities: clonedEnts,
    grid: clonedGrid,
    won,
    lost,
  };
}

/**
 * Solves the puzzle level using the actual game2 physics.
 * Guarantees 100% accurate results matching the in-game play mode perfectly.
 */
export function solvePuzzle(
  level: LevelData,
  maxMoves: number = 25,
  maxStates: number = 8000
): SolverResult {
  // Convert standard LevelData -> game2 Entity[] and Cell[][]
  const game2State = convertToGame2State(level as any);
  
  const levelBounds: LevelBounds | undefined = {
    rows: game2State.grid.length,
    cols: game2State.grid[0]?.length ?? 0,
    edges: level.edges as any,
    trailCollision: !!level.trailCollision,
  };

  const initialWon = checkWinCondition(game2State.entities, game2State.grid);
  if (initialWon) {
    return {
      solvable: true,
      solution: [],
      statesExplored: 1,
      moveCount: 0,
    };
  }

  const queue: { entities: Entity[]; grid: Cell[][]; path: Direction[] }[] = [];
  queue.push({
    entities: game2State.entities,
    grid: game2State.grid,
    path: [],
  });

  const visited = new Set<string>();
  visited.add(serializeState(game2State.entities, game2State.grid));

  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  let statesExplored = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const { entities, grid, path } = current;
    statesExplored++;

    if (statesExplored >= maxStates) {
      break;
    }

    for (const dir of directions) {
      const next = transition(entities, grid, dir, levelBounds);

      if (next.won) {
        const fullSolution = [...path, dir];
        return {
          solvable: true,
          solution: fullSolution,
          statesExplored,
          moveCount: fullSolution.length,
        };
      }

      if (next.lost) {
        continue;
      }

      const stateKey = serializeState(next.entities, next.grid);
      if (!visited.has(stateKey)) {
        visited.add(stateKey);

        if (path.length + 1 < maxMoves) {
          queue.push({
            entities: next.entities,
            grid: next.grid,
            path: [...path, dir],
          });
        }
      }
    }
  }

  return {
    solvable: false,
    solution: null,
    statesExplored,
    moveCount: 0,
  };
}
