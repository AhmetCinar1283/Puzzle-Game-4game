import { Cell } from "./cellTypes";
import { Entity } from "./entityTypes";
import { GameActionButton } from "./actions/types";

// ============================================================
// TEMEL TİPLER
// ============================================================

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Position {
    row: number;
    col: number;
    roomId?: string; // Optional, defaults to 'main'
}

export interface EdgeConfig {
    type: 'wall' | 'portal' | 'lava';
    targetRoomId?: string;
    targetEdge?: 'top' | 'bottom' | 'left' | 'right';
}

export interface RoomState {
    id: string;
    name: string;
    width: number;
    height: number;
    x: number;
    y: number;
    edges: {
        top: EdgeConfig;
        bottom: EdgeConfig;
        left: EdgeConfig;
        right: EdgeConfig;
    };
    grid: Cell[][];
    fogOfWar?: boolean;
    fogVisibilityDistance?: number;
    fogKeepRevealed?: boolean;
    customData?: Record<string, unknown>;
}

// Yön → Izgara adımı (hücreler bu sabitten hareket hesaplar)
export const DIRECTION_DELTA: Record<Direction, Position> = {
    up:    { row: -1, col:  0 },
    down:  { row:  1, col:  0 },
    left:  { row:  0, col: -1 },
    right: { row:  0, col:  1 },
};

// Yön tersine çevirme (direction_toggle ve benzeri hücreler bu sabitten okur)
export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
    up: 'down', down: 'up', left: 'right', right: 'left',
};

// ============================================================
// NESNE ÖZELLİKLERİ (TRAITS)
// ============================================================

export type EntityTrait =
    | 'pushable'          // İtilebilir (Kutu)
    | 'heavy'             // İtilemez (Ağır kasa)
    | 'destructible'      // Lav veya tuzak ile yok edilebilir
    | 'player_controlled' // Oyuncu girdisini dinler
    | 'ethereal'          // Hayalet (Duvarlardan geçebilir)
    | 'invincible';       // Ölümsüz (Forbidden cell öldüremez)

// ============================================================
// UI TİPLERİ
// ============================================================

export type UIButtonType = 'restart' | 'next_level' | 'menu';
export type UITextType = 'info' | 'warning' | 'success' | 'error';

// Nesneler ve hücreler ekrana buton veya yazı çıkartma isteği yollayabilir.
export type UIEvent =
    | { kind: 'button'; buttonType: UIButtonType; label: string }
    | { kind: 'text';   textType: UITextType;   message: string }
    | { kind: 'change_control'; action: 'set' | 'toggle' | 'cycle' | 'add' | 'remove'; targetRooms: string[] };

export type ControlMode = 'all_rooms' | 'selected_room';

// ============================================================
// NİYETLER (INTENTS)
// ============================================================

export type IntentType =
    | 'move'          // Başka bir kareye geçme
    | 'fall'          // Z ekseninde hareket (trampolin, kuş bakışı platform)
    | 'destroy'       // Nesneyi yok etme
    | 'mutate_entity' // Nesnenin state'ini değiştirme
    | 'mutate_cell'   // Zemin tipini değiştirme
    | 'mutate_room';  // Oda state'ini değiştirme

export interface ActionIntent {
    entityId?: number;
    type: IntentType;

    // 'move' için:
    targetPos?: Position;
    force?: number;
    pusherPlayerIndex?: number;
    isPush?: boolean;

    // 'fall' için:
    newZ?: number;
    triggerImpact?: boolean;
    triggerLanded?: boolean;

    // 'mutate_entity' için:
    newDirection?: Direction;
    newForce?: number;
    newElectrifiedState?: boolean;
    customDataPatch?: Record<string, unknown>; // customData alanlarını patch eder

    // 'mutate_cell' için:
    targetCellPos?: Position;
    newCellType?: Cell['type'];

    // 'mutate_room' için:
    roomId?: string;

    // UI & VFX — tüm intent tiplerinde kullanılabilir,
    // motor tarafından ilgili tick'te hemen toplanır.
    vfxTriggers?: string[];
    uiEvent?: UIEvent;
}

// ============================================================
// UI / MOTOR ÇIKTISI
// ============================================================

export type VFXEvent = string; // Açık string — GameBoard type-guard ile ayırt eder

export interface TickSnapshot {
    tickNumber: number;
    rooms: Record<string, RoomState>;
    entities: Entity[];
    vfxEvents: VFXEvent[];
    uiEvents: UIEvent[];
    availableActions?: GameActionButton[];
}
