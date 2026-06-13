import { Cell } from '../cellTypes';
import { CELL_BEHAVIORS, CELL_DEFS } from '../cells/registry';
import { ENTITY_BEHAVIORS } from '../entities/registry';
import { Entity } from '../entityTypes';
import { ActionIntent, Direction, UIEvent, RoomState, Position } from '../types';
import { LevelBounds, getNextTopologyPosition } from './getNextTopologyPosition';
import { getCellAt, mapCrossEdgeIndex } from './rooms';

// ============================================================
// SIFIR MANTIK MOTORU — ALTIN KURAL
// Bu dosya HİÇBİR oyun kuralı, fizik veya matematik içermez.
// Motor sadece bir Trafik Polisi + Postacıdır:
//   0. Önceki tick'ten gelen durum mutasyonlarını hemen uygular
//   1. Niyetleri toplar (behavior'lara sorar)
//   2. Fiziksel imkânsızlıkları engeller (iki katı cisim aynı yere)
//   3. Zincir bağımlılıkları çözer
//   4. Onaylanan niyetleri uygular; hook dönüşlerini ve UI/VFX olaylarını iletir
// ============================================================

export function updateRoomVisibility(entities: Entity[], rooms: Record<string, RoomState>) {
    for (const room of Object.values(rooms)) {
        if (!room.fogOfWar) continue;
        const visibilityDist = room.fogVisibilityDistance ?? 1.5;
        const players = entities.filter(e => e.type === 'player' && (e.position.roomId ?? 'main') === room.id && !e.customData._destroyed);
        
        for (const row of room.grid) {
            for (const cell of row) {
                if (cell.customData.explored) continue;
                
                const isClose = players.some(player => {
                    const dr = cell.position.row - player.position.row;
                    const dc = cell.position.col - player.position.col;
                    return Math.sqrt(dr * dr + dc * dc) <= visibilityDist;
                });
                
                if (isClose) {
                    cell.customData.explored = true;
                }
            }
        }
    }
}

export function processSingleTick(
    entities: Entity[],
    grid: Record<string, RoomState> | Cell[][],
    startingIntents: ActionIntent[],
    levelBounds?: LevelBounds,
): { vfxEvents: string[]; pendingNextTick: ActionIntent[]; uiEvents: UIEvent[] } {

    // Uyum katmanı: tekil 2D grid'i oda formatına sar
    let rooms: Record<string, RoomState> = {};
    if (Array.isArray(grid)) {
        rooms['main'] = {
            id: 'main',
            name: 'Main',
            width: grid[0]?.length ?? 0,
            height: grid.length,
            x: 0, y: 0,
            edges: {
                top: { type: 'wall' },
                bottom: { type: 'wall' },
                left: { type: 'wall' },
                right: { type: 'wall' }
            },
            grid: grid,
        };
    } else {
        rooms = grid;
    }

    const collectedVfx: string[] = [];
    const collectedUi:  UIEvent[] = [];
    const pendingNextTick: ActionIntent[] = [];

    const collectToNextTick = (hookResult: ActionIntent[]) => {
        for (const intent of hookResult) {
            if (intent.vfxTriggers?.length) collectedVfx.push(...intent.vfxTriggers);
            if (intent.uiEvent)             collectedUi.push(intent.uiEvent);
            pendingNextTick.push(intent);
        }
    };

    // ======================================================================
    // 0. FAZ: DURUM MUTASYONLARINI HEMEN UYGULA
    // ======================================================================
    const gameplayStartIntents: ActionIntent[] = [];

    for (const intent of startingIntents) {
        if (intent.uiEvent) collectedUi.push(intent.uiEvent);

        if (intent.type === 'mutate_entity') {
            const entity = entities.find(e => e.id === intent.entityId);
            if (entity) {
                if (intent.newDirection  !== undefined) entity.physics.direction  = intent.newDirection;
                if (intent.newForce      !== undefined) entity.physics.force      = intent.newForce;
                if (intent.newElectrifiedState !== undefined) entity.isElectrified = intent.newElectrifiedState;
                if (intent.newZ          !== undefined) entity.physics.z          = intent.newZ;
                if (intent.customDataPatch)             entity.customData = { ...entity.customData, ...intent.customDataPatch };
            }
        } else if (intent.type === 'mutate_cell') {
            if (intent.targetCellPos) {
                const targetCell = getCellAt(rooms, intent.targetCellPos);
                if (targetCell) {
                    if (intent.newCellType) {
                        targetCell.type = intent.newCellType;
                        targetCell.def  = CELL_DEFS[intent.newCellType];
                    }
                    if (intent.newElectrifiedState !== undefined) {
                        targetCell.isElectrified = intent.newElectrifiedState;
                    }
                }
            }
        } else if (intent.type === 'mutate_room') {
            if (intent.roomId && intent.customDataPatch) {
                const targetRoom = rooms[intent.roomId];
                if (targetRoom) {
                    targetRoom.customData = { ...targetRoom.customData, ...intent.customDataPatch };
                    if (intent.customDataPatch.fogOfWar !== undefined) {
                        targetRoom.fogOfWar = !!intent.customDataPatch.fogOfWar;
                    }
                }
            }
        } else {
            gameplayStartIntents.push(intent);
        }
    }

    // Electrification propagation pass before collecting behaviors intents
    propagateElectricity(rooms, entities);

    // ======================================================================
    // 1. FAZ: NİYETLERİ TOPLA
    // ======================================================================
    let intents: ActionIntent[] = [...gameplayStartIntents];

    for (const room of Object.values(rooms)) {
        for (const row of room.grid) {
            for (const cell of row) {
                const behavior = CELL_BEHAVIORS[cell.type];
                if (behavior?.onTick) {
                    intents.push(...behavior.onTick(cell, entities));
                }
            }
        }
    }

    for (const entity of entities) {
        const behavior = ENTITY_BEHAVIORS[entity.type];
        if (behavior?.onTick) {
            intents.push(...behavior.onTick(entity));
        }
    }

    if (intents.length === 0) {
        return { vfxEvents: collectedVfx, pendingNextTick, uiEvents: collectedUi };
    }

    // Her entity için yalnızca ilk move intent geçerlidir.
    const seenMoveIds = new Set<number>();
    intents = intents.filter(intent => {
        if (intent.type !== 'move') return true;
        if (intent.entityId === undefined) return true;
        if (seenMoveIds.has(intent.entityId)) return false;
        seenMoveIds.add(intent.entityId);
        return true;
    });

    // ======================================================================
    // 2. FAZ: KAFA KAFAYA VE TAKAS ÇARPIŞMALARINI FİLTRELE
    // ======================================================================
    const unfilteredIntents = [...intents];
    intents = filterMutualCollisions(intents, entities);

    // ======================================================================
    // 3. FAZ: ZİNCİRLEME BAĞIMLILIKLARI ÇÖZ
    // ======================================================================
    const approvedIntents = resolveDependencyChains(intents, entities, rooms, levelBounds, unfilteredIntents);

    // ======================================================================
    // 4. FAZ: ONAYLANAN NİYETLERİ UYGULA
    // ======================================================================
    const sortedApproved = [
        ...approvedIntents.filter(i => i.type !== 'fall'),
        ...approvedIntents.filter(i => i.type === 'fall'),
    ];

    const movedEntityIds = new Set<number>();

    for (const intent of sortedApproved) {
        if (intent.vfxTriggers?.length) collectedVfx.push(...intent.vfxTriggers);
        if (intent.uiEvent)             collectedUi.push(intent.uiEvent);

        const entity = intent.entityId !== undefined ? entities.find(e => e.id === intent.entityId) : undefined;
        if (!entity && intent.type !== 'mutate_room' && intent.type !== 'mutate_cell') continue;

        switch (intent.type) {

            case 'move': {
                if (!entity || !intent.targetPos) break;
                if (movedEntityIds.has(entity.id)) break; // bu tick'te zaten hareket etti

                const oldCell = getCellAt(rooms, entity.position);
                if (oldCell) {
                    const leaveBehavior = CELL_BEHAVIORS[oldCell.type];
                    if (leaveBehavior?.onLeave) {
                        collectToNextTick(leaveBehavior.onLeave(oldCell, entity));
                    }
                }

                const prevPos = { ...entity.position };
                entity.position = intent.targetPos;
                movedEntityIds.add(entity.id);
 
                // Cable laying electrification:
                if (entity.type === 'player' && entity.customData.holdingCable) {
                    if (oldCell) oldCell.isElectrified = true;
                    const newCell = getCellAt(rooms, intent.targetPos);
                    if (newCell) newCell.isElectrified = true;

                    if (oldCell && newCell && (oldCell.position.roomId ?? 'main') === (newCell.position.roomId ?? 'main')) {
                        const r1 = oldCell.position.row;
                        const c1 = oldCell.position.col;
                        const r2 = newCell.position.row;
                        const c2 = newCell.position.col;

                        const oldConns = (oldCell.customData.cableConnections as string[]) ?? [];
                        const newConns = (newCell.customData.cableConnections as string[]) ?? [];

                        if (r2 === r1 && c2 === c1 + 1) {
                            if (!oldConns.includes('right')) {
                                oldCell.customData.cableConnections = [...oldConns, 'right'];
                            }
                            if (!newConns.includes('left')) {
                                newCell.customData.cableConnections = [...newConns, 'left'];
                            }
                        } else if (r2 === r1 && c2 === c1 - 1) {
                            if (!oldConns.includes('left')) {
                                oldCell.customData.cableConnections = [...oldConns, 'left'];
                            }
                            if (!newConns.includes('right')) {
                                newCell.customData.cableConnections = [...newConns, 'right'];
                            }
                        } else if (r2 === r1 + 1 && c2 === c1) {
                            if (!oldConns.includes('down')) {
                                oldCell.customData.cableConnections = [...oldConns, 'down'];
                            }
                            if (!newConns.includes('up')) {
                                newCell.customData.cableConnections = [...newConns, 'up'];
                            }
                        } else if (r2 === r1 - 1 && c2 === c1) {
                            if (!oldConns.includes('up')) {
                                oldCell.customData.cableConnections = [...oldConns, 'up'];
                            }
                            if (!newConns.includes('down')) {
                                newCell.customData.cableConnections = [...newConns, 'down'];
                            }
                        }
                    }
                }

                // Trail collision logic:
                if (levelBounds?.trailCollision && entity.type === 'player' && oldCell) {
                    const playerIndex = (entity.customData.playerIndex as number) ?? 0;
                    const EXCLUDED_TRAIL_CELL_TYPES = ['teleport', 'trampoline', 'conveyor', 'toggle', 'power'];
                    if (!EXCLUDED_TRAIL_CELL_TYPES.includes(oldCell.type)) {
                        oldCell.customData.trailPlayerIndex = playerIndex;
                    }
                }

                const newCell = getCellAt(rooms, intent.targetPos);
                if (newCell) {
                    const enterBehavior = CELL_BEHAVIORS[newCell.type];
                    if (enterBehavior?.onEnter) {
                        collectToNextTick(enterBehavior.onEnter(newCell, entity, rooms, entities, prevPos, levelBounds));
                    }
                }
                break;
            }

            case 'fall': {
                if (!entity || intent.newZ === undefined) break;
                entity.physics.z = intent.newZ;

                if (intent.triggerImpact) {
                    const cell = getCellAt(rooms, entity.position);
                    if (cell) {
                        const impactBehavior = CELL_BEHAVIORS[cell.type];
                        if (impactBehavior?.onImpact) {
                            collectToNextTick(impactBehavior.onImpact(cell, entity));
                        }
                    }
                }

                if (intent.triggerLanded) {
                    entity.physics.force = 0;

                    const landCell = getCellAt(rooms, entity.position);

                    // İniş anında aynı konumdaki entity'leri ez
                    for (const other of entities) {
                        if (other.id === entity.id) continue;
                        if (other.customData._destroyed) continue;
                        if ((other.position.roomId ?? 'main') !== (entity.position.roomId ?? 'main')) continue;
                        if (other.position.row !== entity.position.row) continue;
                        if (other.position.col !== entity.position.col) continue;
                        
                        other.customData._destroyed = true;
                        if (other.type === 'player') {
                            other.customData.deathReason = 'crushed';
                            collectedUi.push(
                                { kind: 'text',   textType: 'error', message: 'Oyun bitti! Ezildiniz.' },
                                { kind: 'button', buttonType: 'restart', label: 'Yeniden Başla' },
                            );
                        }
                    }

                    if (landCell?.type === 'obstacle') {
                        landCell.type = 'normal';
                        landCell.def  = CELL_DEFS['normal'];
                    } else if (landCell) {
                        const landCellBehavior = CELL_BEHAVIORS[landCell.type];
                        if (landCellBehavior?.onEnter) {
                            collectToNextTick(landCellBehavior.onEnter(landCell, entity, rooms, entities, undefined, levelBounds));
                        }
                    }

                    const entityBehavior = ENTITY_BEHAVIORS[entity.type];
                    if (entityBehavior?.onLanded) {
                        const landed = entityBehavior.onLanded(entity, entities);
                        if (landed) collectToNextTick(landed);
                    }
                }
                break;
            }

            case 'mutate_entity': {
                if (!entity) break;
                if (intent.newDirection  !== undefined) entity.physics.direction  = intent.newDirection;
                if (intent.newForce      !== undefined) entity.physics.force      = intent.newForce;
                if (intent.newElectrifiedState !== undefined) entity.isElectrified = intent.newElectrifiedState;
                if (intent.newZ          !== undefined) entity.physics.z          = intent.newZ;
                if (intent.customDataPatch) entity.customData = { ...entity.customData, ...intent.customDataPatch };
                break;
            }

            case 'mutate_cell': {
                if (!intent.targetCellPos) break;
                const targetCell = getCellAt(rooms, intent.targetCellPos);
                if (!targetCell) break;
                if (intent.newCellType !== undefined) {
                    targetCell.type = intent.newCellType;
                    targetCell.def  = CELL_DEFS[intent.newCellType];
                }
                if (intent.newElectrifiedState !== undefined) {
                    targetCell.isElectrified = intent.newElectrifiedState;
                }
                if (intent.customDataPatch) {
                    targetCell.customData = { ...targetCell.customData, ...intent.customDataPatch };
                }
                break;
            }

            case 'mutate_room': {
                if (intent.roomId && intent.customDataPatch) {
                    const targetRoom = rooms[intent.roomId];
                    if (targetRoom) {
                        targetRoom.customData = { ...targetRoom.customData, ...intent.customDataPatch };
                        if (intent.customDataPatch.fogOfWar !== undefined) {
                            targetRoom.fogOfWar = !!intent.customDataPatch.fogOfWar;
                        }
                    }
                }
                break;
            }

            case 'destroy': {
                if (entity) {
                    entity.customData._destroyed = true;
                }
                break;
            }
        }
    }

    // ── TRAIL COLLISION CHECK ──
    if (levelBounds?.trailCollision) {
        for (const entity of entities) {
            if (entity.type === 'player' && !entity.customData._destroyed) {
                const currentCell = getCellAt(rooms, entity.position);
                if (currentCell && currentCell.customData.trailPlayerIndex !== undefined) {
                    const trailPlayerIndex = currentCell.customData.trailPlayerIndex as number;
                    const currentPlayerIndex = (entity.customData.playerIndex as number) ?? 0;
                    if (trailPlayerIndex !== currentPlayerIndex) {
                        entity.customData._destroyed = true;
                        entity.customData.deathReason = 'trail';
                        collectedUi.push(
                            { kind: 'text', textType: 'error', message: 'Oyun bitti! Diğer oyuncunun izine bastınız.' },
                            { kind: 'button', buttonType: 'restart', label: 'Yeniden Başla' },
                        );
                    }
                }
            }
        }
    }

    // ── DURABILITY DECREMENT FOR FRAGILE BOXES ──
    for (const intent of intents) {
        if (intent.type === 'move' && intent.isPush) {
            const entity = entities.find(e => e.id === intent.entityId);
            if (entity && entity.type === 'box' && entity.customData.durabilityEnabled && !entity.customData._destroyed) {
                const currentDurability = (entity.customData.durability as number) ?? 0;
                const nextDurability = Math.max(0, currentDurability - 1);
                entity.customData.durability = nextDurability;
                if (nextDurability === 0) {
                    entity.customData._destroyed = true;
                    collectedVfx.push('sound_boing');
                }
            }
        }
    }

    updateRoomVisibility(entities, rooms);
 
    // Final electricity propagation pass
    propagateElectricity(rooms, entities);

    return {
        vfxEvents:      collectedVfx,
        pendingNextTick,
        uiEvents:       collectedUi,
    };
}

// ============================================================
// YARDIMCI FONKSİYONLAR
// ============================================================

function inferMoveDirection(
    from: Position,
    to: Position,
    levelBounds?: LevelBounds
): Direction | null {
    const fromRoom = from.roomId ?? 'main';
    const toRoom = to.roomId ?? 'main';
    if (fromRoom !== toRoom) return null; // Odalar arası sıçramalarda yön çıkarımı yok

    const dr = to.row - from.row;
    const dc = to.col - from.col;
    if (dr === -1 && dc ===  0) return 'up';
    if (dr ===  1 && dc ===  0) return 'down';
    if (dr ===  0 && dc === -1) return 'left';
    if (dr ===  0 && dc ===  1) return 'right';

    // Portal sarmalaması yön çıkarımı
    if (levelBounds && levelBounds.rooms && levelBounds.rooms[fromRoom]) {
        const room = levelBounds.rooms[fromRoom];
        if (to.row === room.rows - 1 && from.row === 0 && dc === 0) return 'up';
        if (to.row === 0 && from.row === room.rows - 1 && dc === 0) return 'down';
        if (to.col === room.cols - 1 && from.col === 0 && dr === 0) return 'left';
        if (to.col === 0 && from.col === room.cols - 1 && dr === 0) return 'right';
    } else if (levelBounds) {
        // Eski format fallback
        const r = levelBounds.rows ?? 0;
        const c = levelBounds.cols ?? 0;
        if (to.row === r - 1 && from.row === 0 && dc === 0) return 'up';
        if (to.row === 0 && from.row === r - 1 && dc === 0) return 'down';
        if (to.col === c - 1 && from.col === 0 && dr === 0) return 'left';
        if (to.col === 0 && from.col === c - 1 && dr === 0) return 'right';
    }

    return null;
}

function getDestinationZ(entityId: number, currentZ: number, intents: ActionIntent[]): number {
    const fallIntent = intents.find(i => i.entityId === entityId && i.type === 'fall');
    if (fallIntent && fallIntent.newZ !== undefined) {
        return fallIntent.newZ;
    }
    const mutation = intents.find(i => i.entityId === entityId && i.type === 'mutate_entity' && i.newZ !== undefined);
    if (mutation && mutation.newZ !== undefined) {
        return mutation.newZ;
    }
    return currentZ;
}

function filterMutualCollisions(intents: ActionIntent[], entities: Entity[]): ActionIntent[] {
    const solidTargetCounts = new Map<string, number>();

    for (const intent of intents) {
        if (!intent.targetPos) continue;
        const entity = entities.find(e => e.id === intent.entityId);
        if (!entity?.def.isSolid) continue;
        const destZ = getDestinationZ(entity.id, entity.physics.z, intents);
        if (intent.type === 'move' && (destZ > 0 || entity.physics.z > 0)) continue;
        
        const rId = intent.targetPos.roomId ?? 'main';
        const key = `${rId},${intent.targetPos.row},${intent.targetPos.col}`;
        solidTargetCounts.set(key, (solidTargetCounts.get(key) ?? 0) + 1);
    }

    return intents.filter(intent => {
        if (!intent.targetPos) return true;
        const me = entities.find(e => e.id === intent.entityId);
        if (!me) return true;
        if (!me.def.isSolid) return true;
        const destZ = getDestinationZ(me.id, me.physics.z, intents);
        if (intent.type === 'move' && (destZ > 0 || me.physics.z > 0)) return true;

        const rId = intent.targetPos.roomId ?? 'main';
        const key = `${rId},${intent.targetPos.row},${intent.targetPos.col}`;

        if ((solidTargetCounts.get(key) ?? 0) > 1) return false;

        const targetEntity = entities.find(e =>
            (e.position.roomId ?? 'main') === rId &&
            e.position.row === intent.targetPos!.row &&
            e.position.col === intent.targetPos!.col &&
            e.def.isSolid &&
            getDestinationZ(e.id, e.physics.z, intents) === 0
        );
        if (targetEntity) {
            const isSwapping = intents.some(i =>
                i.entityId === targetEntity.id &&
                (i.targetPos?.roomId ?? 'main') === (me.position.roomId ?? 'main') &&
                i.targetPos?.row === me.position.row &&
                i.targetPos?.col === me.position.col
            );
            if (isSwapping) return false;
        }

        return true;
    });
}

function resolveDependencyChains(
    intents: ActionIntent[],
    entities: Entity[],
    rooms: Record<string, RoomState>,
    levelBounds?: LevelBounds,
    unfilteredIntents: ActionIntent[] = intents,
): ActionIntent[] {
    let pending = [...intents];
    const approved: ActionIntent[] = [];
    const MAX_PASSES = entities.length + 2;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        let changedThisPass = false;
        const stillPending: ActionIntent[] = [];

        for (const intent of pending) {
            const me = intent.entityId !== undefined ? entities.find(e => e.id === intent.entityId) : undefined;
            if (!me) {
                if (intent.type === 'mutate_room' || intent.type === 'mutate_cell') {
                    approved.push(intent);
                    changedThisPass = true;
                }
                continue;
            }

            let targetPos = intent.targetPos ?? me.position;
            let targetCell = getCellAt(rooms, targetPos);

            // ---- Harita dışı → kenar kuralına bak ----
            if (!targetCell) {
                if (levelBounds && intent.type === 'move' && intent.targetPos) {
                    const dir = inferMoveDirection(me.position, intent.targetPos, levelBounds);
                    if (dir) {
                        const edgeResult = getNextTopologyPosition(me.position, dir, levelBounds);

                        if (edgeResult === 'wall') {
                            changedThisPass = true;
                            continue;
                        } else if (edgeResult === 'lava') {
                            if (me.type === 'player') {
                                approved.push(
                                    { entityId: me.id, type: 'mutate_entity', customDataPatch: { deathReason: 'lava_edge' } },
                                    { entityId: me.id, type: 'destroy', uiEvent: { kind: 'text', textType: 'error', message: 'Oyun bitti! Lava düştünüz.' } },
                                    { entityId: me.id, type: 'mutate_entity', uiEvent: { kind: 'button', buttonType: 'restart', label: 'Yeniden Başla' } },
                                );
                            } else {
                                approved.push({ entityId: me.id, type: 'destroy' });
                            }
                            changedThisPass = true;
                            continue;
                        } else {
                            // Portal — hedefe sar
                            intent.targetPos = edgeResult;
                            targetPos = edgeResult;
                            targetCell = getCellAt(rooms, edgeResult);
                            if (!targetCell) { changedThisPass = true; continue; }
                        }
                    } else {
                        changedThisPass = true;
                        continue;
                    }
                } else {
                    changedThisPass = true;
                    continue;
                }
            }

            // ---- Zemin kontrolü — havadayken (z > 0) atla ----
            const destZ = getDestinationZ(me.id, me.physics.z, intents);
            const isFlyingAtDestination = intent.type === 'move' && destZ > 0;
            let cellAllows = true;

            if (!isFlyingAtDestination) {
                // ── Konveyörden Ters Yönde Çıkış Engeli ──────────────────────────────────
                const currentCell = getCellAt(rooms, me.position);
                if (currentCell && currentCell.type === 'conveyor' && me.physics.z === 0 && intent.type === 'move' && intent.targetPos) {
                    const convDir = currentCell.customData.direction as Direction;
                    if (convDir) {
                        const moveDir = inferMoveDirection(me.position, intent.targetPos, levelBounds);
                        const opposite: Record<Direction, Direction> = {
                            up: 'down', down: 'up', left: 'right', right: 'left'
                        };
                        if (moveDir === opposite[convDir]) {
                            cellAllows = false;
                        }
                    }
                }

                if (cellAllows) {
                    const cellBehavior = CELL_BEHAVIORS[targetCell.type];
                    if (cellBehavior?.onValidateIntent) {
                        cellAllows = cellBehavior.onValidateIntent(targetCell, intent, me);
                    } else if (intent.type === 'move' && !targetCell.def.isWalkable) {
                        cellAllows = false;
                    }
                }
            }

            if (!cellAllows) {
                changedThisPass = true;
                continue;
            }

            // ---- Yerinden oynamayan niyetler (fall, mutate_*, destroy) ----
            const isMovingToNewCell =
                intent.targetPos !== undefined &&
                ((intent.targetPos.roomId ?? 'main') !== (me.position.roomId ?? 'main') ||
                 intent.targetPos.row !== me.position.row ||
                 intent.targetPos.col !== me.position.col);

            if (!isMovingToNewCell) {
                approved.push(intent);
                changedThisPass = true;
                continue;
            }

            // ---- Zincir bağımlılığı — havadayken katı entity'leri yoksay ----
            const blocker = (!isFlyingAtDestination && me.physics.z === 0)
                ? entities.find(e =>
                    e.id !== me.id &&
                    (e.position.roomId ?? 'main') === (targetPos.roomId ?? 'main') &&
                    e.position.row === targetPos.row &&
                    e.position.col === targetPos.col &&
                    e.def.isSolid &&
                    getDestinationZ(e.id, e.physics.z, intents) === 0
                )
                : undefined;

            const blockerIsLeaving = blocker
                ? approved.some(a =>
                    a.entityId === blocker.id &&
                    a.targetPos &&
                    ((a.targetPos.roomId ?? 'main') !== (blocker.position.roomId ?? 'main') ||
                     a.targetPos.row !== blocker.position.row ||
                     a.targetPos.col !== blocker.position.col)
                )
                : false;

            if (!blocker || blockerIsLeaving) {
                approved.push(intent);
                changedThisPass = true;
            } else {
                stillPending.push(intent);
            }
        }

        pending = stillPending;
        if (pending.length === 0) break;

        if (!changedThisPass) {
            const pushOccurred = attemptPushing(pending, intents, entities, rooms, levelBounds);
            if (!pushOccurred) break;
        }
    }

    // Sıfırlama
    const approvedMoveIds = new Set(
        approved.filter(a => a.type === 'move').map(a => a.entityId)
    );

    const mutualFilteredIds = new Set(
        unfilteredIntents
            .filter(ui => ui.type === 'move' && !intents.some(i => i.entityId === ui.entityId))
            .map(ui => ui.entityId)
    );

    for (const intent of unfilteredIntents) {
        if (intent.type !== 'move') continue;
        if (approvedMoveIds.has(intent.entityId)) continue;

        const me = entities.find(e => e.id === intent.entityId);
        if (!me) continue;

        let bumpReason = 'wall';
        const dir = intent.newDirection ?? me.physics.direction ?? 'up';

        if (mutualFilteredIds.has(me.id)) {
            bumpReason = 'collision';
        } else {
            const currentCell = getCellAt(rooms, me.position);
            let conveyorBlock = false;
            if (currentCell && currentCell.type === 'conveyor' && me.physics.z === 0 && intent.targetPos) {
                const convDir = currentCell.customData.direction as Direction;
                if (convDir) {
                    const moveDir = inferMoveDirection(me.position, intent.targetPos, levelBounds);
                    const opposite: Record<Direction, Direction> = {
                        up: 'down', down: 'up', left: 'right', right: 'left'
                    };
                    if (moveDir === opposite[convDir]) {
                        conveyorBlock = true;
                    }
                }
            }

            if (conveyorBlock) {
                bumpReason = 'conveyor';
            } else if (intent.targetPos) {
                const targetCell = getCellAt(rooms, intent.targetPos);
                if (!targetCell) {
                    bumpReason = 'wall';
                } else if (!targetCell.def.isWalkable) {
                    bumpReason = 'wall';
                } else {
                    const blocker = entities.find(e =>
                        e.id !== me.id &&
                        (e.position.roomId ?? 'main') === (intent.targetPos!.roomId ?? 'main') &&
                        e.position.row === intent.targetPos!.row &&
                        e.position.col === intent.targetPos!.col &&
                        e.def.isSolid &&
                        getDestinationZ(e.id, e.physics.z, unfilteredIntents) === 0
                    );
                    if (blocker) {
                        if (blocker.type === 'box') {
                            bumpReason = 'blocked_push';
                        } else {
                            bumpReason = 'wall';
                        }
                    }
                }
            }
        }

        approved.push({
            entityId: intent.entityId,
            type: 'mutate_entity',
            newForce: 0,
            customDataPatch: {
                bumpDirection: dir,
                bumpReason: bumpReason,
            },
            vfxTriggers: ['sound_boing'],
        });
    }

    return approved;
}

function attemptPushing(
    pending: ActionIntent[],
    allIntents: ActionIntent[],
    entities: Entity[],
    rooms: Record<string, RoomState>,
    levelBounds?: LevelBounds
): boolean {
    let pushedSomeone = false;

    for (const intent of pending) {
        if (intent.type !== 'move' || !intent.targetPos) continue;

        const me = entities.find(e => e.id === intent.entityId);
        if (!me) continue;

        const pusherDestZ = getDestinationZ(me.id, me.physics.z, allIntents);
        if (pusherDestZ > 0) continue;

        const moveDir = inferMoveDirection(me.position, intent.targetPos, levelBounds);
        if (!moveDir) continue;

        const targetRoomId = intent.targetPos.roomId ?? 'main';
        const blocker = entities.find(e =>
            (e.position.roomId ?? 'main') === targetRoomId &&
            e.position.row === intent.targetPos!.row &&
            e.position.col === intent.targetPos!.col &&
            getDestinationZ(e.id, e.physics.z, allIntents) === 0
        );
        if (!blocker) continue;

        const blockerAlreadyHasIntent = allIntents.some(i => i.entityId === blocker.id);
        if (blockerAlreadyHasIntent) continue;

        const intentEntity = entities.find(e => e.id === intent.entityId);
        if (!intentEntity) continue;

        // ── Konveyör Üzerinde Ters Yönde İttirme Engeli ─────────────────────────────
        const blockerCell = getCellAt(rooms, blocker.position);
        if (blockerCell && blockerCell.type === 'conveyor') {
            const convDir = blockerCell.customData.direction as Direction;
            if (convDir) {
                const opposite: Record<Direction, Direction> = {
                    up: 'down', down: 'up', left: 'right', right: 'left'
                };
                if (moveDir === opposite[convDir]) {
                    continue;
                }
            }
        }

        const blockerBehavior = ENTITY_BEHAVIORS[blocker.type];
        if (!blockerBehavior?.onPushed) continue;

        const response = blockerBehavior.onPushed(blocker, intentEntity, intent.force ?? 0, moveDir, intent.pusherPlayerIndex);

        if (response.status === 'accept') {
            if (intent.pusherPlayerIndex !== undefined) {
                response.resultingIntent.pusherPlayerIndex = intent.pusherPlayerIndex;
            }
            let boxTarget = response.resultingIntent.targetPos;
            if (boxTarget) {
                const boxDir = inferMoveDirection(blocker.position, boxTarget, levelBounds);
                if (boxDir && levelBounds) {
                    const edgeResult = getNextTopologyPosition(blocker.position, boxDir, levelBounds);
                    if (edgeResult === 'wall') {
                        continue;
                    } else if (edgeResult === 'lava') {
                        boxTarget = undefined;
                    } else {
                        boxTarget = edgeResult;
                    }
                }
            }

            if (boxTarget) {
                const boxTargetCell = getCellAt(rooms, boxTarget);
                if (!boxTargetCell || !boxTargetCell.def.isWalkable) continue;
            }

            if (boxTarget) {
                response.resultingIntent.targetPos = boxTarget;
            }

            pending.push(response.resultingIntent);
            allIntents.push(response.resultingIntent);
            intent.force = response.forceRemaining;
            pushedSomeone = true;
        }
    }

    return pushedSomeone;
}

// ============================================================
// ELECTRICITY PROPAGATION HELPERS
// ============================================================

function isPositionElectrified(rooms: Record<string, RoomState>, pos: Position): boolean {
    const roomId = pos.roomId ?? 'main';
    const room = rooms[roomId];
    if (!room) return false;
    
    // Check 8-neighborhood (including self)
    for (let dr = -1; dr <= 1; dr++) {
        const r = pos.row + dr;
        if (r < 0 || r >= room.height) continue;
        for (let dc = -1; dc <= 1; dc++) {
            const c = pos.col + dc;
            if (c < 0 || c >= room.width) continue;
            
            const cell = room.grid[r][c];
            if (cell.type === 'power' || cell.isElectrified) {
                return true;
            }
        }
    }
    return false;
}

function propagateElectricity(rooms: Record<string, RoomState>, entities: Entity[]) {
    // 1. Electrify cells under players holding cable
    for (const entity of entities) {
        if (entity.type === 'player' && entity.customData.holdingCable && !entity.customData._destroyed) {
            const currentCell = getCellAt(rooms, entity.position);
            if (currentCell) {
                currentCell.isElectrified = true;
            }
        }
    }

    // 2. Propagate electrification state to entities based on adjacency
    for (const entity of entities) {
        if (entity.customData._destroyed) continue;
        
        const isPowered = isPositionElectrified(rooms, entity.position);
        
        if (entity.type === 'box') {
            entity.isElectrified = isPowered;
        } else if (entity.type === 'player') {
            const currentCell = getCellAt(rooms, entity.position);
            const isOnPowerCell = currentCell?.type === 'power';
            entity.isElectrified = !!entity.customData.holdingCable || isOnPowerCell || isPowered;
        }
    }
}

