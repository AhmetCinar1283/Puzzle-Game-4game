import type { CellType } from '../../types';
import type { BehaviorContext, BehaviorResult } from '../engine/types';

// ─── CellBehavior ─────────────────────────────────────────────────────────────

/**
 * A cell behavior defines what happens when an entity enters (or is on) a cell.
 *
 * canEnter (optional) is called BEFORE the entity moves. Returning false stops
 * the entity without triggering onEnter. Omit to always allow entry — the engine
 * handles occupancy and obstacle checks independently.
 *
 * onEnter is called after the entity has moved to the cell. It returns a
 * BehaviorResult describing the entity's new velocity and any side effects.
 *
 * Rules for behavior authors:
 *  - Never mutate TickState directly. Use the sideEffect thunk in BehaviorResult.
 *  - Keep canEnter and onEnter pure: same context always produces the same result.
 *  - Velocities: return the incoming ctx.entity.velocity to continue movement,
 *    or null to stop, or a different Direction to redirect.
 */
export interface CellBehavior {
  /**
   * Gate entry before the entity moves. Return false to block (entity stops,
   * velocity cleared). Inspect ctx.targetCell.occupantIds or customData as needed.
   * If omitted, entry is always allowed (the engine still blocks for obstacles
   * and occupancy independently).
   */
  canEnter?(ctx: BehaviorContext): boolean;
  onEnter(ctx: BehaviorContext): BehaviorResult;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

import { iceBehavior } from './ice';
import { conveyorBehavior } from './conveyor';
import { teleporterBehavior } from './teleporter';
import { directionToggleBehavior } from './directionToggle';
import { forbiddenBehavior } from './forbidden';
import { powerNodeBehavior } from './powerNode';
import { launcherBehavior } from './launcher';
import { trampolineBehavior } from './trampoline';

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

  launcher_up: launcherBehavior,
  launcher_down: launcherBehavior,
  launcher_left: launcherBehavior,
  launcher_right: launcherBehavior,

  trampoline_up: trampolineBehavior,
  trampoline_down: trampolineBehavior,
  trampoline_left: trampolineBehavior,
  trampoline_right: trampolineBehavior,
};
