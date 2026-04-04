import type {
  Direction,
  Position,
  CellType,
  LevelData,
  MovementMode,
  LostReason,
} from '../../types';

// ─── Velocity ─────────────────────────────────────────────────────────────────
// null  = entity stopped / waiting
// Direction = entity advances one cell in this direction next tick
export type Velocity = Direction | null;

export type EntityKind = 'player' | 'box';

// ─── TickEntity ───────────────────────────────────────────────────────────────
// Mutable representation of a game entity during tick resolution.
// Mutated in place during the tick loop; never escapes the engine boundary.
export interface TickEntity {
  kind: EntityKind;
  id: number;
  position: Position;   // mutable — updated each tick step
  velocity: Velocity;   // mutable — null = stopped
  // Player-only fields (undefined for boxes)
  mode?: MovementMode;
  lockOnTarget?: boolean;
  isLocked?: boolean;
  // Box-only
  requiresPower?: boolean;
  // Cycle guards (reset each move resolution)
  _conveyorVisited?: Set<string>; // posKeys of conveyor cells already activated this move
  _teleporterUsed?: Set<string>;  // teleporter groups ('A'|'B'|'C') already used this move
}

// ─── TickState ────────────────────────────────────────────────────────────────
// Internal state for a single move resolution.
export interface TickState {
  readonly level: LevelData;
  readonly grid: CellType[][];
  readonly poweredCells: Set<string>;   // computed once before tick 0
  entities: TickEntity[];               // mutated in-place
  trail: Record<number, Position[]>;    // updated after all ticks
  poweredPlayers: number[];             // grows when player steps on power_node
  animationPaths: Record<string, Position[]>; // "player:1" → [pos0, pos1, ...]
  lostReason?: LostReason;
  didWin: boolean;
}

// ─── BehaviorContext ──────────────────────────────────────────────────────────
// Passed to CellBehavior.onEnter — snapshot of entity + cell + tick state.
// Behaviors must NOT mutate TickState directly; use the sideEffect thunk.
export interface BehaviorContext {
  entity: TickEntity;
  newPosition: Position;   // the cell the entity just entered
  cellType: CellType;
  tick: TickState;
}

// ─── BehaviorResult ───────────────────────────────────────────────────────────
export interface BehaviorResult {
  /** New velocity after entering this cell. null = entity stops here. */
  velocity: Velocity;
  /** Remove entity from the board (box on forbidden/lava). */
  destroyEntity?: boolean;
  /** Override the entity's position (teleporter: jump to exit cell). */
  overridePosition?: Position;
  /**
   * Side effect to apply to TickState after ALL entities in the current tick
   * have been processed. Use for mutations that must not affect mid-tick reads
   * (e.g. adding to poweredPlayers, setting lostReason, flipping mode).
   */
  sideEffect?: (tick: TickState) => void;
}
