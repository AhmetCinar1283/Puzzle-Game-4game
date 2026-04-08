import type { CellBehavior } from './registry';
import type { BehaviorResult, TickState } from '../engine/types';
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
    const exitOccupant = tick.entities.find(
      (e) => !(e.kind === entity.kind && e.id === entity.id) && posEqual(e.position, exitPos),
    );

    const sideEffect = (t: TickState) => {
      const e = t.entities.find((x) => x.kind === entity.kind && x.id === entity.id);
      if (!e) return;
      if (!e._teleporterUsed) e._teleporterUsed = new Set();
      e._teleporterUsed.add(group);
    };

    if (exitOccupant) {
      // If exit is a static box and entity has momentum, signal the tick loop
      // to attempt a push before teleporting. If the push fails, the teleport
      // is cancelled (tick loop skips the sideEffect so cycle guard is not set).
      if (
        exitOccupant.kind === 'box' &&
        exitOccupant.velocity === null &&
        entity.velocity !== null
      ) {
        return {
          velocity: entity.velocity,
          overridePosition: exitPos,
          exitBoxToPush: exitOccupant,
          sideEffect,
        };
      }
      // Player or immovable box → stop
      return { velocity: null };
    }

    return {
      velocity: entity.velocity, // carry momentum through portal
      overridePosition: exitPos,
      sideEffect,
    };
  },
};
