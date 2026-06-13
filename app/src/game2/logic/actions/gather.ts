import { GameActionButton } from "./types";
import { RoomState } from "../types";
import { Entity } from "../entityTypes";
import { CELL_BEHAVIORS } from "../cells/registry";
import { ENTITY_BEHAVIORS } from "../entities/registry";

export function gatherAvailableActions(
    rooms: Record<string, RoomState>,
    entities: Entity[]
): GameActionButton[] {
    const actions: GameActionButton[] = [];
    
    // 1. Gather static room-level actions from room config (e.g. Editor-placed buttons)
    for (const room of Object.values(rooms)) {
        if (room.customData && Array.isArray(room.customData.staticButtons)) {
            for (const btn of room.customData.staticButtons) {
                actions.push({
                    id: btn.id || `static:${room.id}:${btn.actionType}`,
                    actionType: btn.actionType,
                    label: btn.label,
                    icon: btn.icon,
                    target: btn.target || { type: 'room', id: room.id },
                    payload: btn.payload,
                });
            }
        }
    }
    
    // 2. Gather dynamic actions from cell behaviors
    for (const room of Object.values(rooms)) {
        for (const row of room.grid) {
            for (const cell of row) {
                const behavior = CELL_BEHAVIORS[cell.type];
                if (behavior && behavior.getAvailableActions) {
                    try {
                        const cellActions = behavior.getAvailableActions(cell, entities, rooms);
                        actions.push(...cellActions);
                    } catch (err) {
                        console.error(`Error gathering actions from cell ${cell.id} (${cell.type}):`, err);
                    }
                }
            }
        }
    }
    
    // 3. Gather dynamic actions from entity behaviors
    for (const entity of entities) {
        if (entity.customData._destroyed) continue;
        const behavior = ENTITY_BEHAVIORS[entity.type];
        if (behavior && behavior.getAvailableActions) {
            try {
                const entityActions = behavior.getAvailableActions(entity, entities, rooms);
                actions.push(...entityActions);
            } catch (err) {
                console.error(`Error gathering actions from entity ${entity.id} (${entity.type}):`, err);
            }
        }
    }
    
    // 4. Deduplicate to ensure all IDs are unique in the active UI list
    const uniqueActions: GameActionButton[] = [];
    const seenIds = new Set<string>();
    for (const action of actions) {
        if (!seenIds.has(action.id)) {
            seenIds.add(action.id);
            uniqueActions.push(action);
        }
    }
    
    return uniqueActions;
}
