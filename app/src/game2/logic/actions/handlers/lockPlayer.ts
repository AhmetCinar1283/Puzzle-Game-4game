import { ActionHandler } from "../types";
import { ActionIntent } from "../../types";

export const lockPlayerHandler: ActionHandler = (request, context) => {
    if (!request.target || request.target.type !== 'entity') {
        console.warn("[lockPlayerHandler] Missing or invalid target entity");
        return [];
    }
    const targetEntityId = Number(request.target.id);
    const targetEntity = context.entities.find(e => e.id === targetEntityId);
    if (!targetEntity) {
        console.warn(`[lockPlayerHandler] Target entity not found: ${targetEntityId}`);
        return [];
    }
    
    const currentlyLocked = !!targetEntity.customData.isLocked;
    const shouldLock = request.payload && typeof request.payload.isLocked === 'boolean'
        ? request.payload.isLocked
        : !currentlyLocked;

    return [
        {
            entityId: targetEntityId,
            type: 'mutate_entity',
            customDataPatch: {
                isLocked: shouldLock
            }
        }
    ];
};
