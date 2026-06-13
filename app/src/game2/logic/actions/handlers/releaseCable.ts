import { ActionHandler } from "../types";
import { ActionIntent } from "../../types";

export const releaseCableHandler: ActionHandler = (request, context) => {
    if (!request.target || request.target.type !== 'entity') {
        console.warn("[releaseCableHandler] Missing or invalid target entity");
        return [];
    }
    
    const playerId = Number(request.target.id);
    const player = context.entities.find(e => e.id === playerId);
    if (!player || player.type !== 'player') {
        console.warn(`[releaseCableHandler] Player entity not found: ${playerId}`);
        return [];
    }
    
    const currentCell = context.rooms[player.position.roomId ?? 'main']?.grid[player.position.row]?.[player.position.col];
    const isOnPowerCell = currentCell?.type === 'power';
    
    return [
        {
            entityId: player.id,
            type: 'mutate_entity',
            customDataPatch: {
                holdingCable: false
            },
            newElectrifiedState: isOnPowerCell
        }
    ];
};
