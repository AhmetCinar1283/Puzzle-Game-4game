import type { CellBehavior } from './registry';
import type { BehaviorResult } from '../engine/types';
import {
  isTeleporterIn,
  isTeleporterOut,
  teleporterInToOut,
  teleporterOutToIn,
  findCellPosition,
  posEqual,
} from '../positionUtils';

/**
 * Teleporter: jumps entity to the paired exit cell.
 *
 * Works bidirectionally:
 *   teleporter_in_X  → teleporter_out_X (always)
 *   teleporter_out_X → teleporter_in_X  (reverse — entity moved into exit)
 *
 * onEnter fires only when entity MOVES into the cell, so the prevPos condition
 * from the old engine is inherently satisfied.
 *
 * Exit occupancy: if any other entity is at the exit, teleport fails (entity stops).
 *
 * Cycle guard: each teleporter group ('A'|'B'|'C') can be used at most once per
 * move resolution via _teleporterUsed. Prevents ice-slide loops through teleporters.
 *
 * Velocity carry-through: entity arrives at exit with its incoming velocity, so
 * post-teleport ice/conveyor effects kick in naturally on the next tick.
 */
export const teleporterBehavior: CellBehavior = {
  onEnter(ctx): BehaviorResult {
    const { entity, cellType, tick } = ctx;

    // Determine exit cell type
    let exitCellType = null;
    if (isTeleporterIn(cellType)) {
      exitCellType = teleporterInToOut(cellType);
    } else if (isTeleporterOut(cellType)) {
      exitCellType = teleporterOutToIn(cellType);
    }
    if (!exitCellType) return { velocity: null };

    // Cycle guard: each group used at most once per move
    const group = cellType.slice(-1); // 'A', 'B', or 'C'
    if (entity._teleporterUsed?.has(group)) return { velocity: null };

    // Find exit position
    const exitPos = findCellPosition(tick.grid, exitCellType);
    if (!exitPos) return { velocity: null };

    // Exit occupancy check
    const exitOccupied = tick.entities.some(
      (e) => !(e.kind === entity.kind && e.id === entity.id) && posEqual(e.position, exitPos),
    );
    if (exitOccupied) return { velocity: null };

    return {
      velocity: entity.velocity, // carry momentum through portal
      overridePosition: exitPos,
      sideEffect: (t) => {
        const e = t.entities.find((x) => x.kind === entity.kind && x.id === entity.id);
        if (!e) return;
        if (!e._teleporterUsed) e._teleporterUsed = new Set();
        e._teleporterUsed.add(group);
      },
    };
  },
};
