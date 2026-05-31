import { solvePuzzle } from './solver';
import type { LevelData, CellType, LevelEdges, EdgeBehavior, Position, LevelObjectDef, LevelTargetDef, ConveyorCellConfig, TrampolineCellConfig } from '../types';

export interface GeneratorFilters {
  width: number;
  height: number;
  difficulty: 1 | 2 | 3 | 4; // 1: Easy (2-5 moves), 2: Medium (6-10 moves), 3: Hard (11-16 moves), 4: Expert (17-25 moves)
  playerCount: 1 | 2;
  edgeBehavior?: 'wall' | 'portal' | 'lava' | 'random'; // legacy
  edgeTopAllowed?: EdgeBehavior[];
  edgeBottomAllowed?: EdgeBehavior[];
  edgeLeftAllowed?: EdgeBehavior[];
  edgeRightAllowed?: EdgeBehavior[];
  conveyorSteps?: 1 | 2 | 3 | 4 | 5 | 'random';
  trampolineSteps?: 1 | 2 | 3 | 4 | 5 | 'random';
  // Player options
  playerMode: 'normal' | 'reversed' | 'random';
  playerLock: 'lock' | 'nolock' | 'random';
  // Trail collision
  trailCollision: 'yes' | 'no' | 'random';
  // Specific densities (0.0 to 0.5)
  obstacleDensity: number;
  iceDensity: number;
  conveyorDensity: number;
  trampolineDensity: number;
  forbiddenDensity: number;
  toggleDensity: number;
  teleporterCount: number; // Number of teleporter pairs (0 to 3)
}

/** Helper to generate a random number in range [min, max] inclusive */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Shuffles an array in place (Fisher-Yates) */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Check if two positions are equal */
function posEqual(p1: Position, p2: Position): boolean {
  return p1.row === p2.row && p1.col === p2.col;
}

/** Returns the Manhattan distance between two points */
function manhattanDistance(p1: Position, p2: Position): number {
  return Math.abs(p1.row - p2.row) + Math.abs(p1.col - p2.col);
}

/**
 * Builds a single candidate LevelData based on density and filters.
 * Applies connectivity rules to maximize solvability.
 */
function buildCandidate(filters: GeneratorFilters, attemptId: number): LevelData {
  const { width, height, playerCount, edgeBehavior } = filters;

  // 1. Determine Edge Behaviors
  let edges: LevelEdges;
  const behaviors: EdgeBehavior[] = ['wall', 'portal', 'lava'];
  
  const getEdgeForSide = (allowed: EdgeBehavior[] | undefined, fallbackLegacy: 'wall' | 'portal' | 'lava' | 'random' | undefined): EdgeBehavior => {
    if (allowed && allowed.length > 0) {
      return allowed[randomInt(0, allowed.length - 1)];
    }
    const legacy = fallbackLegacy ?? 'wall';
    if (legacy === 'random') {
      return behaviors[randomInt(0, behaviors.length - 1)];
    }
    return legacy as EdgeBehavior;
  };

  edges = {
    top: getEdgeForSide(filters.edgeTopAllowed, edgeBehavior),
    bottom: getEdgeForSide(filters.edgeBottomAllowed, edgeBehavior),
    left: getEdgeForSide(filters.edgeLeftAllowed, edgeBehavior),
    right: getEdgeForSide(filters.edgeRightAllowed, edgeBehavior),
  };

  // 2. Initialize Empty Grid
  const grid: CellType[][] = Array.from({ length: height }, () =>
    Array(width).fill('empty')
  );

  // 3. Select Walkable Cells for Players & Targets
  const allPositions: Position[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      allPositions.push({ row: r, col: c });
    }
  }

  const shuffledPositions = shuffleArray(allPositions);
  const initialObjects: LevelObjectDef[] = [];
  const targets: LevelTargetDef[] = [];

  // Determine player modes based on filter
  const getPlayerMode = (): 'normal' | 'reversed' => {
    if (filters.playerMode === 'random') {
      return Math.random() > 0.5 ? 'normal' : 'reversed';
    }
    return filters.playerMode as 'normal' | 'reversed';
  };

  // Determine player target lock settings
  const getPlayerLock = (): boolean => {
    if (filters.playerLock === 'random') {
      return Math.random() > 0.5;
    }
    return filters.playerLock === 'lock';
  };

  // Place Player 1 & Target 1
  const p1Pos = shuffledPositions.pop()!;
  let t1Idx = shuffledPositions.findIndex((p) => manhattanDistance(p, p1Pos) >= Math.min(3, width - 1));
  if (t1Idx === -1) t1Idx = 0;
  const t1Pos = shuffledPositions.splice(t1Idx, 1)[0];

  initialObjects.push({
    id: 1,
    position: p1Pos,
    mode: getPlayerMode(),
    lockOnTarget: getPlayerLock(),
  });
  targets.push({
    objectId: 1,
    position: t1Pos,
  });
  grid[t1Pos.row][t1Pos.col] = 'target_1';

  // Place Player 2 & Target 2 (if enabled)
  if (playerCount === 2) {
    const p2Pos = shuffledPositions.pop()!;
    let t2Idx = shuffledPositions.findIndex(
      (p) =>
        manhattanDistance(p, p2Pos) >= Math.min(3, width - 1) &&
        !posEqual(p, p1Pos) &&
        !posEqual(p, t1Pos)
    );
    if (t2Idx === -1) t2Idx = 0;
    const t2Pos = shuffledPositions.splice(t2Idx, 1)[0];

    initialObjects.push({
      id: 2,
      position: p2Pos,
      mode: getPlayerMode(),
      lockOnTarget: getPlayerLock(),
    });
    targets.push({
      objectId: 2,
      position: t2Pos,
    });
    grid[t2Pos.row][t2Pos.col] = 'target_2';
  }

  // Helper set of preserved cells (start/end positions cannot be overridden)
  const reserved = new Set<string>();
  initialObjects.forEach((o) => reserved.add(`${o.position.row},${o.position.col}`));
  targets.forEach((t) => reserved.add(`${t.position.row},${t.position.col}`));

  // 4. Carve Walkways (DFS Path) to Guarantee Basic Solvability
  const pathCells = new Set<string>();
  const carvePath = (start: Position, end: Position) => {
    let curr = { ...start };
    while (!posEqual(curr, end)) {
      pathCells.add(`${curr.row},${curr.col}`);
      const dRow = Math.sign(end.row - curr.row);
      const dCol = Math.sign(end.col - curr.col);

      if (dRow !== 0 && (dCol === 0 || Math.random() > 0.5)) {
        curr.row += dRow;
      } else if (dCol !== 0) {
        curr.col += dCol;
      }
    }
  };

  initialObjects.forEach((obj, idx) => {
    carvePath(obj.position, targets[idx].position);
  });

  // 5. Populate Remaining Grid with Special Tiles
  // Gradually relax obstacle density if many attempts fail
  const obstacleDensity = Math.max(0.02, filters.obstacleDensity - attemptId * 0.001);
  const iceDensity = filters.iceDensity;
  const conveyorDensity = filters.conveyorDensity;
  const trampolineDensity = filters.trampolineDensity;
  const forbiddenDensity = filters.forbiddenDensity;
  const toggleDensity = filters.toggleDensity;

  // Portals placement: pairs (A, B, C)
  const portalsToPlace: ('A' | 'B' | 'C')[] = [];
  if (filters.teleporterCount >= 1) portalsToPlace.push('A');
  if (filters.teleporterCount >= 2) portalsToPlace.push('B');
  if (filters.teleporterCount >= 3) portalsToPlace.push('C');

  // Filter out remaining grid positions
  const placementPool = shuffleArray(allPositions.filter((p) => !reserved.has(`${p.row},${p.col}`)));

  while (placementPool.length > 0) {
    const pos = placementPool.pop()!;
    const key = `${pos.row},${pos.col}`;
    const onMainPath = pathCells.has(key);

    const rand = Math.random();
    let cumulative = 0;

    // Obstacles: placed only off main path to maximize solver chances
    if (!onMainPath && rand < (cumulative += obstacleDensity)) {
      grid[pos.row][pos.col] = 'obstacle';
      continue;
    }

    // Ice
    if (rand < (cumulative += iceDensity)) {
      grid[pos.row][pos.col] = 'ice';
      continue;
    }

    // Conveyors
    if (rand < (cumulative += conveyorDensity)) {
      const dirs: CellType[] = ['conveyor_up', 'conveyor_down', 'conveyor_left', 'conveyor_right'];
      grid[pos.row][pos.col] = dirs[randomInt(0, 3)];
      continue;
    }

    // Trampolines
    if (rand < (cumulative += trampolineDensity)) {
      const dirs: CellType[] = ['trampoline_up', 'trampoline_down', 'trampoline_left', 'trampoline_right'];
      grid[pos.row][pos.col] = dirs[randomInt(0, 3)];
      continue;
    }

    // Forbidden
    if (rand < (cumulative += forbiddenDensity)) {
      grid[pos.row][pos.col] = 'forbidden';
      continue;
    }

    // Toggles
    if (rand < (cumulative += toggleDensity)) {
      grid[pos.row][pos.col] = 'direction_toggle';
      continue;
    }

    // Place matching teleporter portals if popped
    if (portalsToPlace.length > 0 && placementPool.length >= 1) {
      const portalType = portalsToPlace.pop()!;
      const matchingPos = placementPool.pop()!;

      grid[pos.row][pos.col] = `teleporter_in_${portalType}` as CellType;
      grid[matchingPos.row][matchingPos.col] = `teleporter_out_${portalType}` as CellType;
    }
  }

  // Determine trail collision
  const getTrailCollision = (): boolean => {
    if (filters.trailCollision === 'random') {
      return Math.random() > 0.5;
    }
    return filters.trailCollision === 'yes';
  };

  // Generate conveyor and trampoline custom step configs
  const conveyorConfig: ConveyorCellConfig[] = [];
  const conveyorStepsVal = filters.conveyorSteps ?? 1;
  const trampolineConfig: TrampolineCellConfig[] = [];
  const trampolineStepsVal = filters.trampolineSteps ?? 3;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = grid[r][c];
      if (cell && cell.startsWith('conveyor_')) {
        const steps = conveyorStepsVal === 'random' ? randomInt(1, 3) : conveyorStepsVal;
        conveyorConfig.push({ position: { row: r, col: c }, steps });
      } else if (cell && cell.startsWith('trampoline_')) {
        const steps = trampolineStepsVal === 'random' ? randomInt(2, 4) : trampolineStepsVal;
        trampolineConfig.push({ position: { row: r, col: c }, steps });
      }
    }
  }

  return {
    id: randomInt(1000, 9999),
    name: `Procedural Level ${randomInt(1, 999)}`,
    width,
    height,
    edges,
    grid,
    initialObjects,
    targets,
    trailCollision: getTrailCollision(),
    conveyorConfig: conveyorConfig.length > 0 ? conveyorConfig : undefined,
    trampolineConfig: trampolineConfig.length > 0 ? trampolineConfig : undefined,
  };
}

/**
 * Procedurally generates a premium puzzle level matching the desired filters.
 * Runs an intelligent Generate & Test loop: generates candidates, solves them using
 * the BFS solver, and yields the first level satisfying the difficulty bounds.
 *
 * @param filters Configuration settings including sizes, difficulty, and allowed tiles.
 * @returns The fully calibrated LevelData and the optimal solve path.
 */
export function generateProceduralLevel(filters: GeneratorFilters): {
  level: LevelData;
  solution: string[] | null;
  moveCount: number;
} {
  // Define difficulty ranges (shortest solution paths)
  const difficultyRanges: Record<1 | 2 | 3 | 4, { min: number; max: number }> = {
    1: { min: 2, max: 5 },
    2: { min: 6, max: 10 },
    3: { min: 11, max: 16 },
    4: { min: 17, max: 25 },
  };

  const range = difficultyRanges[filters.difficulty];

  let bestMatch: LevelData | null = null;
  let bestSolution: string[] | null = null;
  let bestDiffScore = Infinity;
  let bestMoveCount = 0;

  const maxAttempts = 150;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = buildCandidate(filters, attempt);

    // Solve candidate using BFS
    const maxSearchDepth = filters.difficulty === 4 ? 28 : 22;
    const solveResult = solvePuzzle(candidate, maxSearchDepth, 4000);

    if (solveResult.solvable && solveResult.solution) {
      const moves = solveResult.solution.length;

      // Check if moves fit inside the desired range
      if (moves >= range.min && moves <= range.max) {
        return {
          level: {
            ...candidate,
            difficulty: filters.difficulty,
          },
          solution: solveResult.solution,
          moveCount: moves,
        };
      }

      // Keep track of closest match
      let diffScore = 0;
      if (moves < range.min) diffScore = range.min - moves;
      else if (moves > range.max) diffScore = moves - range.max;

      if (diffScore < bestDiffScore) {
        bestDiffScore = diffScore;
        bestMatch = candidate;
        bestSolution = solveResult.solution;
        bestMoveCount = moves;
      }
    }
  }

  // Fallback to closest solvable match
  if (bestMatch && bestSolution) {
    return {
      level: {
        ...bestMatch,
        difficulty: filters.difficulty,
      },
      solution: bestSolution,
      moveCount: bestMoveCount,
    };
  }

  // Ultimate fallback
  const fallbackLevel = buildCandidate({
    ...filters,
    obstacleDensity: 0,
    iceDensity: 0.1,
    conveyorDensity: 0,
    trampolineDensity: 0,
    forbiddenDensity: 0,
    toggleDensity: 0,
    teleporterCount: 0
  }, 99);
  const fallbackSolve = solvePuzzle(fallbackLevel, 15, 2000);

  return {
    level: {
      ...fallbackLevel,
      difficulty: filters.difficulty,
    },
    solution: fallbackSolve.solution,
    moveCount: fallbackSolve.solution?.length ?? 0,
  };
}
