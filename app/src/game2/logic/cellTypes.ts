import { ActionIntent, Position, RoomState } from "./types";
import { Entity } from "./entityTypes";
import { LevelBounds } from "./engine/getNextTopologyPosition";

export interface CellDef {
    friction: number;
    durability?: number;
    isWalkable: boolean;
}

export type CellTypes =
    | 'normal' | 'obstacle' | 'forbidden' | 'ice'
    | 'power' | 'toggle'
    | 'conveyor' | 'trampoline' | 'teleport'
    | 'target'
    | 'control_switch'; // Yeni hücre tipi: oda kontrolünü değiştirir

// SAF VERİ — JSON'a çevrilebilir, behavior içermez.
// Motor, davranışları her zaman CELL_BEHAVIORS[cell.type] registry'sinden okur.
export interface Cell {
    id: string;
    type: CellTypes;
    position: Position;
    def: CellDef;
    isElectrified: boolean;
    customData: Record<string, unknown>;
}

// CellBehavior arayüzü burada yaşamaya devam eder;
// sadece Cell'in içine gömülmez — registry'de kullanılır.
export interface CellBehavior {
    onEnter?: (
        cell: Cell,
        entity: Entity,
        rooms: Record<string, RoomState> | Cell[][],
        entities: Entity[],
        prevPos?: Position,
        levelBounds?: LevelBounds
    ) => ActionIntent[];
    onLeave?: (cell: Cell, entity: Entity) => ActionIntent[];
    onImpact?: (cell: Cell, fallingEntity: Entity) => ActionIntent[];
    onTick?: (cell: Cell, entities: Entity[]) => ActionIntent[];

    // Zemin, kendisine gelen niyeti onaylar veya reddeder.
    onValidateIntent?: (targetCell: Cell, intent: ActionIntent, self: Entity) => boolean;
}