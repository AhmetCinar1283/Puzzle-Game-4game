import { ActionHandler } from "../types";
import { ActionIntent } from "../../types";

export const toggleLightsHandler: ActionHandler = (request, context) => {
    if (!request.target || request.target.type !== 'room') {
        console.warn("[toggleLightsHandler] Missing or invalid target room");
        return [];
    }
    const roomId = String(request.target.id);
    const room = context.rooms[roomId];
    if (!room) {
        console.warn(`[toggleLightsHandler] Target room not found: ${roomId}`);
        return [];
    }

    const currentlyFog = room.fogOfWar ?? false;
    const shouldFog = request.payload && typeof request.payload.fogOfWar === 'boolean'
        ? request.payload.fogOfWar
        : !currentlyFog;

    return [
        {
            type: 'mutate_room',
            roomId: roomId,
            customDataPatch: {
                fogOfWar: shouldFog
            }
        }
    ];
};
