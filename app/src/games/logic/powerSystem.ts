import type { CellType, LevelData, BoxState, Position } from '../types';
import { posKey, findCellPosition, teleporterInToOut, isTeleporterIn } from './positionUtils';

const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/**
 * Computes the set of powered cell positions for the current turn.
 *
 * Power sources:
 *   - All power_node grid cells
 *   - Trail positions of players who have stepped on a power_node (poweredPlayers)
 *
 * Power propagates to adjacent power-dependent entities:
 *   - Conveyor cells listed in level.conveyorPowerRequired
 *   - Boxes with requiresPower: true (at their current positions)
 *
 * Teleporter propagation: if a powered cell is teleporter_in_X, the paired
 * teleporter_out_X also becomes powered (and BFS continues from there).
 *
 * Returns a Set of posKey strings for all powered cell positions.
 */
export function computePoweredCells(
  grid: CellType[][],
  level: LevelData,
  poweredPlayers: number[],
  trail: Record<number, Position[]>,
  boxes: BoxState[],
): Set<string> {
  const powered = new Set<string>();
  const queue: Position[] = [];

  function seed(pos: Position) {
    const key = posKey(pos);
    if (!powered.has(key)) {
      powered.add(key);
      queue.push(pos);
    }
  }

  // Seed: all power_node cells
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] === 'power_node') {
        seed({ row, col });
      }
    }
  }

  // Seed: trail positions of powered players
  for (const playerId of poweredPlayers) {
    const playerTrail = trail[playerId] ?? [];
    for (const pos of playerTrail) {
      seed(pos);
    }
  }

  // Build lookup sets for quick power-dependency checks
  const conveyorPowerSet = new Set<string>(
    (level.conveyorPowerRequired ?? []).map(posKey)
  );
  const powerDependentBoxSet = new Set<string>(
    boxes.filter(b => b.requiresPower).map(b => posKey(b.position))
  );

  // BFS: extend power to adjacent power-dependent entities
  const teleporterQueue: Position[] = [];

  while (queue.length > 0 || teleporterQueue.length > 0) {
    const pos = queue.shift() ?? teleporterQueue.shift()!;

    // Check teleporter propagation: if this powered cell is a teleporter_in,
    // power the corresponding teleporter_out and continue BFS from there
    const cell = grid[pos.row]?.[pos.col];
    if (cell && isTeleporterIn(cell)) {
      const outType = teleporterInToOut(cell);
      if (outType) {
        const outPos = findCellPosition(grid, outType);
        if (outPos) {
          const outKey = posKey(outPos);
          if (!powered.has(outKey)) {
            powered.add(outKey);
            teleporterQueue.push(outPos);
          }
        }
      }
    }

    // Propagate to adjacent power-dependent entities
    for (const [dr, dc] of DIRS) {
      const neighbor: Position = { row: pos.row + dr, col: pos.col + dc };
      if (
        neighbor.row < 0 || neighbor.row >= grid.length ||
        neighbor.col < 0 || neighbor.col >= (grid[0]?.length ?? 0)
      ) continue;

      const neighborKey = posKey(neighbor);
      if (powered.has(neighborKey)) continue;

      const isDepConveyor = conveyorPowerSet.has(neighborKey);
      const isDepBox = powerDependentBoxSet.has(neighborKey);

      if (isDepConveyor || isDepBox) {
        powered.add(neighborKey);
        queue.push(neighbor);
      }
    }
  }

  return powered;
}

/** Returns true if the conveyor at the given position is active. */
export function isConveyorActive(pos: Position, level: LevelData, poweredCells: Set<string>): boolean {
  const conveyorPowerSet = new Set<string>(
    (level.conveyorPowerRequired ?? []).map(posKey)
  );
  if (!conveyorPowerSet.has(posKey(pos))) return true; // no power requirement → always active
  return poweredCells.has(posKey(pos));
}

/** Returns true if the box at the given position is currently pushable (ignoring other blockers). */
export function isBoxPushable(box: BoxState, poweredCells: Set<string>): boolean {
  if (!box.requiresPower) return true;
  return poweredCells.has(posKey(box.position));
}
