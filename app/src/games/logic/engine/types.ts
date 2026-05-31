import type {
  Direction,
  Position,
  Waypoint,
  CellType,
  LevelData,
  MovementMode,
  LostReason,
  GameState,
  GameObjectState,
  BoxState,
} from '../../types';

// ─── CellState ────────────────────────────────────────────────────────────────
// Active cell data. O(1) lookup for occupants.
export interface CellState {
  type: CellType;
  /** IDs of entities on this cell. */
  occupantIds: number[];
  /** Custom data for cell mechanics (durability, counters, etc.). */
  customData?: Record<string, unknown>;
}

// ─── NeighborMap ──────────────────────────────────────────────────────────────
// Snapshot of 4 orthogonal neighbors. null = out of bounds.
export interface NeighborInfo {
  cell: CellState;
  entities: TickEntity[];
}
export type NeighborMap = Record<Direction, NeighborInfo | null>;

// ─── Velocity ─────────────────────────────────────────────────────────────────
// null = stopped. Direction = moving next tick.
export type Velocity = Direction | null;

// ─── Momentum (DEPRECATED — kept only for type-check compatibility during migration) ──
// TODO: remove after all callers migrated to entity.force
export interface Momentum {
  dir: Direction;
  stepsLeft: number;
  totalSteps: number;
  zProfile?: number[];
}

export type EntityKind = 'player' | 'box';

// ─── EntityBehavior ───────────────────────────────────────────────────────────

export type OnPushedResult =
  | { outcome: 'push_succeeded' }   // Pushed successfully, mover continues
  | { outcome: 'push_blocked' }     // Path blocked, mover stops
  | { outcome: 'mutual_stop' }      // Player vs player collision, both stop
  | { outcome: 'occupant_moving' }; // Occupant is already moving, mover stops

export interface FinalizeContext {
  tickEntity: TickEntity | undefined; // undefined = destroyed
  prevState: GameState;
  tick: TickState;
}

export type FinalizeResult =
  | { kind: 'player_state'; state: GameObjectState; trailEntry?: Position }
  | { kind: 'box_state'; state: BoxState }
  | { kind: 'destroyed' };

/** Defines entity behavior without engine dependency. */
export interface EntityBehavior {
  // ── Flags ────────────────────────────────────────────────────────────────────
  /** Takes input velocity. */
  readonly isUserControlled: boolean;
  /** Used for order resolution. */
  readonly participatesInOrderResolution: boolean;
  /** Processing order in a tick. Lower is earlier (player: 0, box: 1). */
  readonly processingPriority: number;
  /** Can be destroyed by lava or forbidden cells. */
  readonly isDestructible: boolean;
  /** Leaves a movement trail. */
  readonly generatesTrail: boolean;
  /** Starts a chain push when hit while idle. */
  readonly isPushChainRoot: boolean;

  // ── Hooks ─────────────────────────────────────────────────────────────────────
  /** Called when another entity tries to move into this cell. */
  onPushed(
    self: TickEntity,
    mover: TickEntity,
    tick: TickState,
    toRemove: Set<TickEntity>,
  ): OnPushedResult;

  /** Called when entity hits a lava edge. Return true to halt tick loop. */
  onLavaEdge(
    self: TickEntity,
    tick: TickState,
    toRemove: Set<TickEntity>,
  ): { halt: boolean };

  /** Updates public GameState after movement ends. */
  onFinalize(ctx: FinalizeContext): FinalizeResult;
}

// ─── TickEntity ───────────────────────────────────────────────────────────────
// Mutable game entity state during ticks.
export interface TickEntity {
  kind: string;   
  id: number;
  position: Position;   // Updated each tick step
  velocity: Velocity;   // null = stopped
  behavior: EntityBehavior;
  
  // Player-only fields
  mode?: MovementMode;
  lockOnTarget?: boolean;
  isLocked?: boolean;
  
  // Box-only fields
  requiresPower?: boolean;
  
  // Height (0 = ground, > 0 = airborne). Decremented each step while airborne.
  z: number;

  // ── Physics ──────────────────────────────────────────────────────────────────
  /**
   * Momentum magnitude — replaces the old momentum.stepsLeft system.
   *
   * Rules:
   *   Ground step cost : force -= mass  (entity moves if force >= mass)
   *   Ice / airborne   : force -= 0     (entity moves if force > 0, frictionless)
   *   Conveyor N steps : force = mass * N
   *   Trampoline N steps: force = mass * N, z = N
   *   Landing (z→0)    : force *= 0.5
   *   Elastic push     : mover.force → box.force (equal mass = full transfer)
   *
   * Initialized to 0. assignInitialVelocities sets force = mass for user-input.
   */
  force: number;
  /** Mass (default 1). Affects push resistance and force depletion rate. */
  mass?: number;
  /** HP. Destroyed at 0. Undefined = indestructible. */
  durability?: number;
  /** Entity pushing this one right now. Cleared each step. */
  pushedBy?: TickEntity;

  // ── Cycle Guards ─────────────────────────────────────────────────────────────
  _conveyorVisited?: Set<string>; // Visited conveyor positions
  _teleporterUsed?: Set<string>;  // Used teleporter groups
  /** @deprecated Use entity.force instead */
  momentum?: Momentum;
}

// ─── TickState ────────────────────────────────────────────────────────────────
// Internal state for one move resolution.
export interface TickState {
  readonly level: LevelData;
  readonly grid: CellState[][];         // Active grid
  readonly poweredCells: Set<string>;   
  entities: TickEntity[];               // Mutated in-place
  trail: Record<number, Position[]>;    
  poweredPlayers: number[];             
  animationPaths: Record<string, Waypoint[]>; 
  conveyorRemainingUses: Record<string, number>; 
  lostReason?: LostReason;
  didWin: boolean;
}

// ─── Contexts ─────────────────────────────────────────────────────────────────

// Passed when an entity enters a cell.
export interface BehaviorContext {
  entity: TickEntity;
  newPosition: Position;   
  cellType: CellType;
  targetCell: CellState;   
  tick: TickState;
  pusher?: TickEntity;
  isPowered: boolean;
  neighbors: NeighborMap;
}

// Passed when an entity is about to leave a cell.
export interface LeaveContext {
  entity: TickEntity;
  fromPosition: Position;
  toPosition: Position;
  cellType: CellType;
  cell: CellState;         
  tick: TickState;
  isPowered: boolean;
  neighbors: NeighborMap;
}

// Passed when an entity is idle on a cell.
export interface IdleContext {
  entity: TickEntity;
  position: Position;
  cellType: CellType;
  cell: CellState;
  tick: TickState;
  isPowered: boolean;
  neighbors: NeighborMap;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function entityKey(e: TickEntity): string {
  return `${e.kind}:${e.id}`;
}

/** Removes entity from current cell's occupantIds. */
export function removeFromGrid(tick: TickState, entity: TickEntity): void {
  const cell = tick.grid[entity.position.row]?.[entity.position.col];
  if (cell) cell.occupantIds = cell.occupantIds.filter((id) => id !== entity.id);
}

/** Adds entity to a cell's occupantIds. */
export function addToGrid(tick: TickState, pos: Position, entity: TickEntity): void {
  const cell = tick.grid[pos.row]?.[pos.col];
  if (cell && !cell.occupantIds.includes(entity.id)) cell.occupantIds.push(entity.id);
}

/** Gets the first entity on a cell, excluding excludeId. */
export function getOccupantEntity(
  tick: TickState,
  pos: Position,
  excludeId: number,
  toRemove: Set<TickEntity>,
): TickEntity | undefined {
  const cell = tick.grid[pos.row]?.[pos.col];
  if (!cell || cell.occupantIds.length === 0) return undefined;
  
  const id = cell.occupantIds.find((id) => id !== excludeId);
  if (id === undefined) return undefined;
  
  const e = tick.entities.find((e) => e.id === id);
  return e && !toRemove.has(e) ? e : undefined;
}

// ─── BehaviorResult ───────────────────────────────────────────────────────────
export interface BehaviorResult {
  /** New velocity. null = stops here. */
  velocity: Velocity;
  /** If true, destroy the entity. */
  destroyEntity?: boolean;
  /** Teleport to this position. */
  overridePosition?: Position;
  /** Run this mutation after all entities are processed. */
  sideEffect?: (tick: TickState) => void;
  /** Teleporter exit box to push before teleporting. */
  exitBoxToPush?: TickEntity;
}