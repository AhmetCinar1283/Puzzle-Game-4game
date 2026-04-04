import type { CellType } from '../../types';
import type { BehaviorContext, BehaviorResult } from '../engine/types';

// ─── CellBehavior ─────────────────────────────────────────────────────────────

/**
 * A cell behavior defines what happens when an entity enters (or is on) a cell.
 *
 * onEnter is called after the entity has moved to the cell. It returns a
 * BehaviorResult describing the entity's new velocity and any side effects.
 *
 * Rules for behavior authors:
 *  - Never mutate TickState directly. Use the sideEffect thunk in BehaviorResult.
 *  - Keep onEnter pure: same context always produces the same result.
 *  - Velocities: return the incoming ctx.entity.velocity to continue movement,
 *    or null to stop, or a different Direction to redirect.
 */
export interface CellBehavior {
  onEnter(ctx: BehaviorContext): BehaviorResult;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

import { iceBehavior } from './ice';
import { conveyorBehavior } from './conveyor';
import { teleporterBehavior } from './teleporter';
import { directionToggleBehavior } from './directionToggle';
import { forbiddenBehavior } from './forbidden';
import { powerNodeBehavior } from './powerNode';

/**
 * Maps each CellType to its behavior module.
 * Cell types omitted here (empty, obstacle, target_1/2) cause entities to stop —
 * the tick loop treats a missing entry as { velocity: null }.
 *
 * To add a new cell type: create a behavior module and add one line here.
 */
export const CELL_BEHAVIORS: Partial<Record<CellType, CellBehavior>> = {
  ice: iceBehavior,

  conveyor_up: conveyorBehavior,
  conveyor_down: conveyorBehavior,
  conveyor_left: conveyorBehavior,
  conveyor_right: conveyorBehavior,

  teleporter_in_A: teleporterBehavior,
  teleporter_in_B: teleporterBehavior,
  teleporter_in_C: teleporterBehavior,
  teleporter_out_A: teleporterBehavior,
  teleporter_out_B: teleporterBehavior,
  teleporter_out_C: teleporterBehavior,

  direction_toggle: directionToggleBehavior,
  forbidden: forbiddenBehavior,
  power_node: powerNodeBehavior,
};
