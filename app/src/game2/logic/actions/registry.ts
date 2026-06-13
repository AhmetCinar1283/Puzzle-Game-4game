import { ActionHandler, GameActionRequest } from "./types";
import { RoomState, ActionIntent } from "../types";
import { Entity } from "../entityTypes";
import { lockPlayerHandler } from "./handlers/lockPlayer";
import { toggleLightsHandler } from "./handlers/toggleLights";
import { holdCableHandler } from "./handlers/holdCable";
import { releaseCableHandler } from "./handlers/releaseCable";

export const ACTION_HANDLERS: Record<string, ActionHandler> = {
    'lock_player': lockPlayerHandler,
    'toggle_lights': toggleLightsHandler,
    'hold_cable': holdCableHandler,
    'release_cable': releaseCableHandler,
};

export function processActionRequest(
    request: GameActionRequest,
    rooms: Record<string, RoomState>,
    entities: Entity[]
): ActionIntent[] {
    const handler = ACTION_HANDLERS[request.actionType];
    if (!handler) {
        console.warn(`[ActionRegistry] No handler registered for action type: ${request.actionType}`);
        return [];
    }
    try {
        return handler(request, { rooms, entities });
    } catch (err) {
        console.error(`[ActionRegistry] Error running handler for ${request.actionType}:`, err);
        return [];
    }
}
