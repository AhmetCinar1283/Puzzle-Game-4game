export type CellType =
  | 'empty'
  | 'obstacle'
  | 'forbidden'
  | 'target_1'
  | 'target_2'
  | 'direction_toggle';

export type EdgeBehavior = 'wall' | 'portal';

export type MovementMode = 'normal' | 'reversed';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type GamePhase = 'playing' | 'won' | 'lost';

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
}

export type GameAction =
  | { type: 'MOVE'; direction: Direction }
  | { type: 'RESTART' }
  | { type: 'LOAD_LEVEL'; level: LevelData };