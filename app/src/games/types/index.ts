export type CellType =
  | 'empty'
  | 'obstacle'
  | 'forbidden'
  | 'target_1'
  | 'target_2'
  | 'direction_toggle';

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
  phase: GamePhase;
  moveCount: number;
  trail: Record<number, Position[]>;
  lostReason?: LostReason;
}

export type GameAction =
  | { type: 'MOVE'; direction: Direction }
  | { type: 'RESTART' }
  | { type: 'LOAD_LEVEL'; level: LevelData };
