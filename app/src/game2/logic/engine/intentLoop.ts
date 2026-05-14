import { Cell } from '../cellTypes';
import { CELL_BEHAVIORS, CELL_DEFS } from '../cells/registry';
import { ENTITY_BEHAVIORS } from '../entities/registry';
import { Entity } from '../entityTypes';
import { ActionIntent, Direction, UIEvent } from '../types';
import { LevelBounds, getNextTopologyPosition } from './getNextTopologyPosition';

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

export function processSingleTick(
    entities: Entity[],
    grid: Cell[][],
    startingIntents: ActionIntent[],
    levelBounds?: LevelBounds,
): { vfxEvents: string[]; pendingNextTick: ActionIntent[]; uiEvents: UIEvent[] } {

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
            if (intent.targetCellPos && intent.newCellType) {
                const targetCell = grid[intent.targetCellPos.row]?.[intent.targetCellPos.col];
                if (targetCell) {
                    targetCell.type = intent.newCellType;
                    targetCell.def  = CELL_DEFS[intent.newCellType];
                }
            }
        } else {
            gameplayStartIntents.push(intent);
        }
    }

    // ======================================================================
    // 1. FAZ: NİYETLERİ TOPLA
    // ======================================================================
    let intents: ActionIntent[] = [...gameplayStartIntents];

    for (const row of grid) {
        for (const cell of row) {
            const behavior = CELL_BEHAVIORS[cell.type];
            if (behavior?.onTick) {
                intents.push(...behavior.onTick(cell, entities));
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
    // startingIntents'ten gelen teleport/diğer hareketer onTick hareketine göre önceliklidir.
    const seenMoveIds = new Set<number>();
    intents = intents.filter(intent => {
        if (intent.type !== 'move') return true;
        if (seenMoveIds.has(intent.entityId)) return false;
        seenMoveIds.add(intent.entityId);
        return true;
    });

    // ======================================================================
    // 2. FAZ: KAFA KAFAYA VE TAKAS ÇARPIŞMALARINI FİLTRELE
    // ======================================================================
    intents = filterMutualCollisions(intents, entities);

    // ======================================================================
    // 3. FAZ: ZİNCİRLEME BAĞIMLILIKLARI ÇÖZ
    // ======================================================================
    const approvedIntents = resolveDependencyChains(intents, entities, grid, levelBounds);

    // ======================================================================
    // 4. FAZ: ONAYLANAN NİYETLERİ UYGULA
    // ======================================================================
    // Fall intent'leri en sona bırak: triggerLanded ezme kontrolü
    // entity konumunu kullandığından, tüm move'lar önce uygulanmalıdır.
    const sortedApproved = [
        ...approvedIntents.filter(i => i.type !== 'fall'),
        ...approvedIntents.filter(i => i.type === 'fall'),
    ];

    // Bir entity aynı tick'te yalnızca bir kez hareket edebilir.
    // (Teleport + onTick move gibi çift-move durumlarını önler.)
    const movedEntityIds = new Set<number>();

    for (const intent of sortedApproved) {
        if (intent.vfxTriggers?.length) collectedVfx.push(...intent.vfxTriggers);
        if (intent.uiEvent)             collectedUi.push(intent.uiEvent);

        const entity = entities.find(e => e.id === intent.entityId);
        if (!entity) continue;

        switch (intent.type) {

            case 'move': {
                if (!intent.targetPos) break;
                if (movedEntityIds.has(entity.id)) break; // bu tick'te zaten hareket etti

                const oldCell = grid[entity.position.row]?.[entity.position.col];
                if (oldCell) {
                    const leaveBehavior = CELL_BEHAVIORS[oldCell.type];
                    if (leaveBehavior?.onLeave) {
                        collectToNextTick(leaveBehavior.onLeave(oldCell, entity));
                    }
                }

                entity.position = intent.targetPos;
                movedEntityIds.add(entity.id);

                // Havadayken (z > 0) hücre efektleri uygulanmaz — onEnter kendi kontrol eder
                const newCell = grid[intent.targetPos.row]?.[intent.targetPos.col];
                if (newCell) {
                    const enterBehavior = CELL_BEHAVIORS[newCell.type];
                    if (enterBehavior?.onEnter) {
                        collectToNextTick(enterBehavior.onEnter(newCell, entity));
                    }
                }
                break;
            }

            case 'fall': {
                if (intent.newZ === undefined) break;
                entity.physics.z = intent.newZ;

                if (intent.triggerImpact) {
                    const cell = grid[entity.position.row]?.[entity.position.col];
                    if (cell) {
                        const impactBehavior = CELL_BEHAVIORS[cell.type];
                        if (impactBehavior?.onImpact) {
                            collectToNextTick(impactBehavior.onImpact(cell, entity));
                        }
                    }
                }

                if (intent.triggerLanded) {
                    const landCell = grid[entity.position.row]?.[entity.position.col];

                    // İniş anında aynı konumdaki entity'leri ez (flying entity hayatta kalır)
                    for (const other of entities) {
                        if (other.id === entity.id) continue;
                        if (other.customData._destroyed) continue;
                        if (other.position.row !== entity.position.row) continue;
                        if (other.position.col !== entity.position.col) continue;
                        other.customData._destroyed = true;
                        if (other.type === 'player') {
                            collectedUi.push(
                                { kind: 'text',   textType: 'error', message: 'Oyun bitti! Ezildiniz.' },
                                { kind: 'button', buttonType: 'restart', label: 'Yeniden Başla' },
                            );
                        }
                    }

                    // Engel hücresine iniliyorsa hücreyi parçala
                    if (landCell?.type === 'obstacle') {
                        landCell.type = 'normal';
                        landCell.def  = CELL_DEFS['normal'];
                    } else if (landCell) {
                        const landCellBehavior = CELL_BEHAVIORS[landCell.type];
                        if (landCellBehavior?.onEnter) {
                            collectToNextTick(landCellBehavior.onEnter(landCell, entity));
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
                if (intent.newDirection  !== undefined) entity.physics.direction  = intent.newDirection;
                if (intent.newForce      !== undefined) entity.physics.force      = intent.newForce;
                if (intent.newElectrifiedState !== undefined) entity.isElectrified = intent.newElectrifiedState;
                if (intent.newZ          !== undefined) entity.physics.z          = intent.newZ;
                if (intent.customDataPatch) entity.customData = { ...entity.customData, ...intent.customDataPatch };
                break;
            }

            case 'mutate_cell': {
                if (!intent.targetCellPos || !intent.newCellType) break;
                const targetCell = grid[intent.targetCellPos.row]?.[intent.targetCellPos.col];
                if (!targetCell) break;
                targetCell.type = intent.newCellType;
                targetCell.def  = CELL_DEFS[intent.newCellType];
                break;
            }

            case 'destroy': {
                entity.customData._destroyed = true;
                break;
            }
        }
    }

    return {
        vfxEvents:      collectedVfx,
        pendingNextTick,
        uiEvents:       collectedUi,
    };
}

// ============================================================
// YARDIMCI FONKSİYONLAR
// ============================================================

// Tek adımlık harekette yönü pozisyon farkından çıkar.
// Teleport gibi çok adımlı hareketlerde null döner.
function inferMoveDirection(from: { row: number; col: number }, to: { row: number; col: number }): Direction | null {
    const dr = to.row - from.row;
    const dc = to.col - from.col;
    if (dr === -1 && dc ===  0) return 'up';
    if (dr ===  1 && dc ===  0) return 'down';
    if (dr ===  0 && dc === -1) return 'left';
    if (dr ===  0 && dc ===  1) return 'right';
    return null;
}

function filterMutualCollisions(intents: ActionIntent[], entities: Entity[]): ActionIntent[] {
    const solidTargetCounts = new Map<string, number>();

    for (const intent of intents) {
        if (!intent.targetPos) continue;
        const entity = entities.find(e => e.id === intent.entityId);
        if (!entity?.def.isSolid) continue;
        // Havadaki entity zemin engeline tabi değil
        if (intent.type === 'move' && entity.physics.z > 0) continue;
        const key = `${intent.targetPos.row},${intent.targetPos.col}`;
        solidTargetCounts.set(key, (solidTargetCounts.get(key) ?? 0) + 1);
    }

    return intents.filter(intent => {
        if (!intent.targetPos) return true;
        const me = entities.find(e => e.id === intent.entityId);
        if (!me) return true;
        if (!me.def.isSolid) return true;
        // Havadaki entity her şeyin üzerinden geçer
        if (intent.type === 'move' && me.physics.z > 0) return true;

        const key = `${intent.targetPos.row},${intent.targetPos.col}`;

        if ((solidTargetCounts.get(key) ?? 0) > 1) return false;

        const targetEntity = entities.find(e =>
            e.position.row === intent.targetPos!.row &&
            e.position.col === intent.targetPos!.col &&
            e.def.isSolid
        );
        if (targetEntity) {
            const isSwapping = intents.some(i =>
                i.entityId === targetEntity.id &&
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
    grid: Cell[][],
    levelBounds?: LevelBounds,
): ActionIntent[] {
    let pending = [...intents];
    const approved: ActionIntent[] = [];
    const MAX_PASSES = entities.length + 2;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        let changedThisPass = false;
        const stillPending: ActionIntent[] = [];

        for (const intent of pending) {
            const me = entities.find(e => e.id === intent.entityId);
            if (!me) continue;

            const targetPos = intent.targetPos ?? me.position;
            let targetCell = grid[targetPos.row]?.[targetPos.col];

            // ---- Harita dışı → kenar kuralına bak ----
            if (!targetCell) {
                if (levelBounds && intent.type === 'move' && intent.targetPos) {
                    const dir = inferMoveDirection(me.position, intent.targetPos);
                    if (dir) {
                        const edgeResult = getNextTopologyPosition(me.position, dir, levelBounds);

                        if (edgeResult === 'wall') {
                            // Duvara çarptı — dur
                            changedThisPass = true;
                            continue;
                        } else if (edgeResult === 'lava') {
                            // Lav — entity yok edilir
                            if (me.type === 'player') {
                                approved.push(
                                    { entityId: me.id, type: 'destroy', uiEvent: { kind: 'text', textType: 'error', message: 'Oyun bitti!' } },
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
                            targetCell = grid[edgeResult.row]?.[edgeResult.col];
                            if (!targetCell) { changedThisPass = true; continue; }
                        }
                    } else {
                        // Tek adımlı olmayan hareket (teleport çıkışı vb.) — durdur
                        changedThisPass = true;
                        continue;
                    }
                } else {
                    // Kenar bilgisi yok → varsayılan duvar davranışı
                    changedThisPass = true;
                    continue;
                }
            }

            // ---- Zemin kontrolü — havadayken (z > 0) atla ----
            const isFlying = intent.type === 'move' && me.physics.z > 0;
            let cellAllows = true;

            if (!isFlying) {
                const cellBehavior = CELL_BEHAVIORS[targetCell.type];
                if (cellBehavior?.onValidateIntent) {
                    cellAllows = cellBehavior.onValidateIntent(targetCell, intent, me);
                } else if (intent.type === 'move' && !targetCell.def.isWalkable) {
                    cellAllows = false;
                }
            }

            if (!cellAllows) {
                changedThisPass = true;
                continue;
            }

            // ---- Yerinden oynamayan niyetler (fall, mutate_*, destroy) ----
            const isMovingToNewCell =
                intent.targetPos !== undefined &&
                (intent.targetPos.row !== me.position.row ||
                    intent.targetPos.col !== me.position.col);

            if (!isMovingToNewCell) {
                approved.push(intent);
                changedThisPass = true;
                continue;
            }

            // ---- Zincir bağımlılığı — havadayken katı entity'leri yoksay ----
            const blocker = !isFlying
                ? entities.find(e =>
                    e.id !== me.id &&
                    e.position.row === targetPos.row &&
                    e.position.col === targetPos.col &&
                    e.def.isSolid
                )
                : undefined;

            const blockerIsLeaving = blocker
                ? approved.some(a =>
                    a.entityId === blocker.id &&
                    a.targetPos &&
                    (a.targetPos.row !== blocker.position.row ||
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
            const pushOccurred = attemptPushing(pending, intents, entities, grid);
            if (!pushOccurred) break;
        }
    }

    // Hareketi engellenen entity'lerin force'unu sıfırla.
    // Aksi hâlde onTick her tick yeni bir move intent üretir ve döngü kilitlenir.
    const approvedMoveIds = new Set(
        approved.filter(a => a.type === 'move').map(a => a.entityId)
    );
    for (const intent of intents) {
        if (intent.type !== 'move') continue;
        if (approvedMoveIds.has(intent.entityId)) continue;
        approved.push({ entityId: intent.entityId, type: 'mutate_entity', newForce: 0 });
    }

    return approved;
}

function attemptPushing(
    pending: ActionIntent[],
    allIntents: ActionIntent[],
    entities: Entity[],
    grid: Cell[][]
): boolean {
    let pushedSomeone = false;

    for (const intent of pending) {
        if (intent.type !== 'move' || !intent.targetPos) continue;

        const blocker = entities.find(e =>
            e.position.row === intent.targetPos!.row &&
            e.position.col === intent.targetPos!.col
        );
        if (!blocker) continue;

        const blockerAlreadyHasIntent = allIntents.some(i => i.entityId === blocker.id);
        if (blockerAlreadyHasIntent) continue;

        const intentEntity = entities.find(e => e.id === intent.entityId);
        if (!intentEntity) continue;

        const blockerBehavior = ENTITY_BEHAVIORS[blocker.type];
        if (!blockerBehavior?.onPushed) continue;

        const response = blockerBehavior.onPushed(blocker, intentEntity, intent.force ?? 0);

        if (response.status === 'accept') {
            // Kutunun gideceği hedef hücrenin geçerli olup olmadığını kontrol et
            const boxTarget = response.resultingIntent.targetPos;
            if (boxTarget) {
                const boxTargetCell = grid[boxTarget.row]?.[boxTarget.col];
                if (!boxTargetCell || !boxTargetCell.def.isWalkable) continue;
            }
            pending.push(response.resultingIntent);
            allIntents.push(response.resultingIntent);
            intent.force = response.forceRemaining;
            pushedSomeone = true;
        }
    }

    return pushedSomeone;
}
