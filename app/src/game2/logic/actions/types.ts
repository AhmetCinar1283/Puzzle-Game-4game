import { ActionIntent, RoomState } from "../types";
import { Entity } from "../entityTypes";

export interface GameActionButton {
    id: string; // Unique ID for this action instance in a tick
    actionType: string; // Identifier like 'lock_player', 'toggle_lights'
    label: string; // User-facing button label
    icon?: string; // Optional icon emoji/symbol
    target?: {
        type: 'cell' | 'entity' | 'room' | 'global';
        id: string | number; // Entity ID, Room ID, or Cell coordinate (e.g., "main:2,3")
    };
    payload?: Record<string, any>;
}

export interface GameActionRequest {
    actionType: string;
    target?: {
        type: 'cell' | 'entity' | 'room' | 'global';
        id: string | number;
    };
    payload?: Record<string, any>;
}

export type ActionHandler = (
    request: GameActionRequest,
    context: {
        rooms: Record<string, RoomState>;
        entities: Entity[];
    }
) => ActionIntent[];
