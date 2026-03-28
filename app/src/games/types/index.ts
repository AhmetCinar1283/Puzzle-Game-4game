export type CellType =
  | 'empty'
  | 'obstacle'
  | 'forbidden'
  | 'target_1'
  | 'target_2'
  | 'direction_toggle'
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
  | 'teleporter_out_C';

export type EdgeBehavior = 'wall' | 'portal' | 'lava';

export type MovementMode = 'normal' | 'reversed';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type GamePhase = 'playing' | 'won' | 'lost';

export type LostReason = 'forbidden' | 'lava_edge' | 'trail';

export interface Position {
  row: number;
  col: number;
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
}

export interface BoxState {
  id: number;
  position: Position;
  requiresPower: boolean;
}

export interface LevelData {
  id: number;
  name: string;
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
}

export type GameAction =
  | { type: 'MOVE'; direction: Direction }
  | { type: 'RESTART' }
  | { type: 'LOAD_LEVEL'; level: LevelData };
