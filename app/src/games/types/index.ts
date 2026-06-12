export type CellType =
  | 'empty'
  | 'obstacle'
  | 'forbidden'
  | 'target_1'
  | 'target_2'
  | 'direction_toggle'
  | 'control_switch'
  | 'direction_deflector'
  | 'ice'
  | 'power_node'
  | 'conveyor_up'
  | 'conveyor_down'
  | 'conveyor_left'
  | 'conveyor_right'
  | 'teleporter_in_A'
  | 'teleporter_out_A'
  | 'teleporter_in_B'
  | 'teleporter_out_B'
  | 'teleporter_in_C'
  | 'teleporter_out_C'
  | 'trampoline_up'
  | 'trampoline_down'
  | 'trampoline_left'
  | 'trampoline_right';

export type EdgeBehavior = 'wall' | 'portal' | 'lava';

export type MovementMode = 'normal' | 'reversed';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type GamePhase = 'playing' | 'won' | 'lost';

export type LostReason = 'forbidden' | 'lava_edge' | 'trail' | 'crushed';

export type MoveAnimType = 'portal' | 'teleport' | 'ice' | 'conveyor' | 'normal';

export interface Position {
  row: number;
  col: number;
  roomId?: string;
}

/** A position waypoint that also carries the entity's height (z) at that step.
 *  z = 0 → ground level. z > 0 → airborne (e.g. trampoline arc).
 *  Used in animationPaths so the render layer can drive a CSS scale effect. */
export interface Waypoint {
  row: number;
  col: number;
  z: number;
}

export interface LevelEdges {
  top: EdgeBehavior;
  bottom: EdgeBehavior;
  left: EdgeBehavior;
  right: EdgeBehavior;
}

export interface LevelObjectDef {
  id: number;
  position: Position;
  mode: MovementMode;
  lockOnTarget: boolean;
}

export interface LevelTargetDef {
  objectId: number;
  position: Position;
}

export interface BoxDef {
  id: number;
  position: Position;
  /** If true, box can only be pushed when adjacent to a powered cell. Default: always pushable. */
  requiresPower?: boolean;
  durabilityEnabled?: boolean;
  durability?: number;
  colorFilterEnabled?: boolean;
  colorFilterIndex?: number;
}

export interface TrampolineCellConfig {
  position: Position;
  /** How many cells the entity is flung (airborne — skips intermediate terrain). Default: 3. */
  steps: number;
}

export interface ConveyorCellConfig {
  position: Position;
  /** How many cells the entity slides when launched by this conveyor. Default: 1. */
  steps?: number;
  /** Total number of times this conveyor can fire. undefined = unlimited. */
  uses?: number;
}

export interface DeflectorCellConfig {
  position: Position;
  mapping: Record<Direction, Direction>;
}

export interface BoxState {
  id: number;
  position: Position;
  requiresPower: boolean;
}

export interface LevelData {
  id: number;
  /** Firestore document ID — set for preset levels, undefined for user-created levels. */
  firestoreId?: string;
  name: string;
  lockedCells?: Record<string, boolean>;
  width: number;
  height: number;
  edges: LevelEdges;
  grid: CellType[][];
  initialObjects: LevelObjectDef[];
  targets: LevelTargetDef[];
  /** If true: landing on the opponent's trail causes a loss. Trails are only rendered when this is enabled. */
  trailCollision?: boolean;
  /** Initial box placements. */
  initialBoxes?: BoxDef[];
  /** Conveyor cells that require adjacent power to activate. */
  conveyorPowerRequired?: Position[];
  /** Per-cell conveyor configuration (steps, use limit). Cells not listed use defaults. */
  conveyorConfig?: ConveyorCellConfig[];
  /** Per-cell trampoline configuration (steps). Cells not listed use default (3 steps). */
  trampolineConfig?: TrampolineCellConfig[];
  /** Per-cell direction deflector configuration (mappings). */
  deflectorConfig?: DeflectorCellConfig[];

  difficulty?: 1 | 2 | 3 | 4;
  creatorName?: string;
  rooms?: any[];
  controlMode?: 'all_rooms' | 'selected_room';
  initialControlledRooms?: string[];
}

export interface GameObjectState {
  id: number;
  position: Position;
  mode: MovementMode;
  lockOnTarget: boolean;
  isLocked: boolean;
}

export interface GameState {
  level: LevelData;
  objects: GameObjectState[];
  boxes: BoxState[];
  /** Player IDs that have stepped on a power_node (their trail becomes an electric cable). */
  poweredPlayers: number[];
  phase: GamePhase;
  moveCount: number;
  trail: Record<number, Position[]>;
  lostReason?: LostReason;
  moveAnimTypes?: Record<number, MoveAnimType>;
  /** Per-entity ordered waypoints for smooth multi-step animation. Key: "player:1", "box:2".
   *  Each waypoint carries z (height) so the renderer can drive a scale/arc effect. */
  animationPaths?: Record<string, Waypoint[]>;
  /** Remaining activation count per conveyor cell (posKey → count). Persists across moves. */
  conveyorRemainingUses?: Record<string, number>;
}

export type GameAction =
  | { type: 'MOVE'; direction: Direction }
  | { type: 'RESTART' }
  | { type: 'LOAD_LEVEL'; level: LevelData };
