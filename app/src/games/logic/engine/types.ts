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
// Active cell representation: knows its type AND who is currently standing on it.
// Replaced the old CellType[][] grid so occupancy is O(1) to read/write.
export interface CellState {
  type: CellType;
  /** Entity IDs currently occupying this cell. Updated whenever an entity moves. */
  occupantIds: number[];
  /** Arbitrary per-cell data for future mechanics (e.g. durability, toggles). */
  customData?: Record<string, unknown>;
}

// ─── Velocity ─────────────────────────────────────────────────────────────────
// null  = entity stopped / waiting
// Direction = entity advances one cell in this direction next tick
export type Velocity = Direction | null;

// ─── Momentum ─────────────────────────────────────────────────────────────────
// Unified multi-step movement state — replaces the old _conveyorMomentum.
// Used by conveyors, launchers, and trampolines.
export interface Momentum {
  dir: Direction;
  stepsLeft: number;
  totalSteps: number; // constant; used to compute current step index for zProfile
  /**
   * Height (z) of the entity at each step of this momentum arc.
   * Index = totalSteps - stepsLeft at the START of that step.
   * Undefined → entity stays at ground level (z = 0) throughout.
   *
   * Example (5-step trampoline): [2, 4, 4, 2, 0]
   *   step 0 → z=2 (lift-off), step 2 → z=4 (peak), step 4 → z=0 (landing)
   */
  zProfile?: number[];
}

export type EntityKind = 'player' | 'box';

// ─── EntityBehavior ───────────────────────────────────────────────────────────

export type OnPushedResult =
  | { outcome: 'push_succeeded' }   // itildi, yol açıldı; mover devam eder
  | { outcome: 'push_blocked' }     // zincir tıkandı; mover durur
  | { outcome: 'mutual_stop' }      // player vs player; ikisi de durur
  | { outcome: 'occupant_moving' }; // occupant zaten hareket halinde; mover durur

export interface FinalizeContext {
  tickEntity: TickEntity | undefined; // undefined = entity yok edildi
  prevState: GameState;
  tick: TickState;
}

export type FinalizeResult =
  | { kind: 'player_state'; state: GameObjectState; trailEntry?: Position }
  | { kind: 'box_state'; state: BoxState }
  | { kind: 'destroyed' };

/**
 * Her entity türünün engine'e bağımlılık olmadan davranışını tanımladığı interface.
 * Yeni entity türü = yeni EntityBehavior implementasyonu + init.ts'te 1 satır.
 */
export interface EntityBehavior {
  // ── Flags ────────────────────────────────────────────────────────────────────
  /** Kullanıcı girdisinden hız alır. True ise assignInitialVelocities'e girer. */
  readonly isUserControlled: boolean;
  /** Artık kullanılmıyor — Kahn sort kaldırıldı, fixpoint loop sıralama sorununu çözüyor. */
  readonly participatesInOrderResolution: boolean;
  /** Tick içi işlem önceliği. Düşük = önce işlenir. (player: 0, box: 1) */
  readonly processingPriority: number;
  /** Lava/forbidden ile kalıcı olarak tahtadan kaldırılabilir. */
  readonly isDestructible: boolean;
  /** Hareket ettiğinde iz bırakır (trail). */
  readonly generatesTrail: boolean;
  /** Durağan hâlde bir entity çarptığında chain push başlatır. */
  readonly isPushChainRoot: boolean;

  // ── Hooks ─────────────────────────────────────────────────────────────────────
  /** Başka bir entity bu entity'nin hücresine hareket etmeye çalışıyor. */
  onPushed(
    self: TickEntity,
    mover: TickEntity,
    tick: TickState,
    toRemove: Set<TickEntity>,
  ): OnPushedResult;

  /**
   * Entity bir lava edge'e ulaştı (position güncellenmeden önce çağrılır).
   * Halt true döndürülürse tick loop mevcut iterasyonu kırar.
   */
  onLavaEdge(
    self: TickEntity,
    tick: TickState,
    toRemove: Set<TickEntity>,
  ): { halt: boolean };

  /** Tüm hareket tamamlandıktan sonra public GameState'e katkı sağlar. */
  onFinalize(ctx: FinalizeContext): FinalizeResult;
}

// ─── TickEntity ───────────────────────────────────────────────────────────────
// Mutable representation of a game entity during tick resolution.
// Mutated in place during the tick loop; never escapes the engine boundary.
export interface TickEntity {
  kind: string;   // 'player' | 'box' | gelecekte yeni tipler; engine artık buna dallanmaz
  id: number;
  position: Position;   // mutable — updated each tick step
  velocity: Velocity;   // mutable — null = stopped
  behavior: EntityBehavior;
  // Player-only fields (undefined for boxes)
  mode?: MovementMode;
  lockOnTarget?: boolean;
  isLocked?: boolean;
  // Box-only
  requiresPower?: boolean;
  // Height on the Z axis (0 = ground; > 0 = airborne).
  // Set from momentum.zProfile at the start of each loop step.
  z: number;
  // Cycle guards (reset each move resolution)
  _conveyorVisited?: Set<string>; // posKeys of conveyor cells already activated this move
  _teleporterUsed?: Set<string>;  // teleporter groups ('A'|'B'|'C') already used this move
  // Unified movement momentum — drives multi-step sliding and trampoline arcs.
  momentum?: Momentum;
}

// ─── TickState ────────────────────────────────────────────────────────────────
// Internal state for a single move resolution.
export interface TickState {
  readonly level: LevelData;
  readonly grid: CellState[][];         // active grid — tracks occupants per cell
  readonly poweredCells: Set<string>;   // computed once before tick 0
  entities: TickEntity[];               // mutated in-place
  trail: Record<number, Position[]>;    // updated after all ticks
  poweredPlayers: number[];             // grows when player steps on power_node
  animationPaths: Record<string, Waypoint[]>; // "player:1" → [waypoint0, waypoint1, ...]
  conveyorRemainingUses: Record<string, number>; // posKey → remaining uses; mutated when conveyor fires
  lostReason?: LostReason;
  didWin: boolean;
}

// ─── BehaviorContext ──────────────────────────────────────────────────────────
// Passed to CellBehavior.canEnter / onEnter — snapshot of entity + cell + tick state.
// Behaviors must NOT mutate TickState directly; use the sideEffect thunk.
export interface BehaviorContext {
  entity: TickEntity;
  newPosition: Position;   // the cell the entity just entered
  cellType: CellType;
  targetCell: CellState;   // full cell state — use for canEnter decisions and richer onEnter logic
  tick: TickState;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function entityKey(e: TickEntity): string {
  return `${e.kind}:${e.id}`;
}

/** Remove entity from its current cell's occupantIds. Call before updating entity.position. */
export function removeFromGrid(tick: TickState, entity: TickEntity): void {
  const cell = tick.grid[entity.position.row]?.[entity.position.col];
  if (cell) cell.occupantIds = cell.occupantIds.filter((id) => id !== entity.id);
}

/** Add entity to a cell's occupantIds. Call after updating entity.position. */
export function addToGrid(tick: TickState, pos: Position, entity: TickEntity): void {
  const cell = tick.grid[pos.row]?.[pos.col];
  if (cell && !cell.occupantIds.includes(entity.id)) cell.occupantIds.push(entity.id);
}

/**
 * Find the first entity occupying pos, excluding the entity with excludeId.
 * Uses CellState.occupantIds for O(1) lookup instead of scanning tick.entities.
 */
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
  /**
   * Teleporter-only: if exit is occupied by a pushable box, the tick loop will
   * attempt pushChainImmediately on this entity before applying the teleport.
   * If the push fails, the teleport is cancelled (sideEffect is NOT added so
   * the cycle guard is not set).
   */
  exitBoxToPush?: TickEntity;
}
