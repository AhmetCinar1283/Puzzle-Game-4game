import { ActionHandler } from "../types";
import { ActionIntent } from "../../types";

export const holdCableHandler: ActionHandler = (request, context) => {
    if (!request.target || request.target.type !== 'entity') {
        console.warn("[holdCableHandler] Missing or invalid target entity");
        return [];
    }
    
    const playerId = Number(request.target.id);
    const player = context.entities.find(e => e.id === playerId);
    if (!player || player.type !== 'player') {
        console.warn(`[holdCableHandler] Player entity not found: ${playerId}`);
        return [];
    }
    
    const intents: ActionIntent[] = [
        {
            entityId: player.id,
            type: 'mutate_entity',
            customDataPatch: {
                holdingCable: true
            },
            newElectrifiedState: true
        },
        {
            type: 'mutate_cell',
            targetCellPos: player.position,
            newElectrifiedState: true
        }
    ];
    
    return intents;
};
