import { Cell } from '../cellTypes';
import { CELL_BEHAVIORS, CELL_DEFS } from '../cells/registry';
import { ENTITY_BEHAVIORS } from '../entities/registry';
import { Entity } from '../entityTypes';
import { ActionIntent, UIEvent } from '../types';

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
    startingIntents: ActionIntent[]   // Önceki tick'ten taşınan niyetler
): { vfxEvents: string[]; pendingNextTick: ActionIntent[]; uiEvents: UIEvent[] } {

    const collectedVfx: string[] = [];
    const collectedUi:  UIEvent[] = [];
    const pendingNextTick: ActionIntent[] = [];

    // Hook sonuçlarını toplamak için yardımcı.
    // VFX ve UI anında toplanır (bu tick gösterilir).
    // Oyun niyetleri (move, mutate, vb.) sonraki tick'e gider.
    const collectToNextTick = (hookResult: ActionIntent[]) => {
        for (const intent of hookResult) {
            if (intent.vfxTriggers?.length) collectedVfx.push(...intent.vfxTriggers);
            if (intent.uiEvent)             collectedUi.push(intent.uiEvent);
            pendingNextTick.push(intent);
        }
    };

    // ======================================================================
    // 0. FAZ: DURUM MUTASYONLARINI HEMEN UYGULA
    // Önceki tick'ten gelen mutate_entity / mutate_cell niyetleri,
    // onTick'ten ÖNCE uygulanır; böylece entity'ler güncel state'i görür.
    // (Örn: normalCell.onEnter force=0 döndürdü → bu tick'te onTick force'u 0 görür)
    // ======================================================================
    const gameplayStartIntents: ActionIntent[] = [];

    for (const intent of startingIntents) {
        if (intent.uiEvent) collectedUi.push(intent.uiEvent);

        if (intent.type === 'mutate_entity') {
            // Saf atama — motor matematik yapmaz
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
            // move, fall, destroy → çarpışma kontrolünden geçsin
            gameplayStartIntents.push(intent);
        }
    }

    // ======================================================================
    // 1. FAZ: NİYETLERİ TOPLA
    // Motor üretmez — sadece dinler.
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

    // ======================================================================
    // 2. FAZ: KAFA KAFAYA VE TAKAS ÇARPIŞMALARINI FİLTRELE
    // ======================================================================
    intents = filterMutualCollisions(intents, entities);

    // ======================================================================
    // 3. FAZ: ZİNCİRLEME BAĞIMLILIKLARI ÇÖZ
    // ======================================================================
    const approvedIntents = resolveDependencyChains(intents, entities, grid);

    // ======================================================================
    // 4. FAZ: ONAYLANAN NİYETLERİ UYGULA
    // Motor lojistiği sağlar; hook dönüşlerini collectToNextTick ile iletir.
    // ======================================================================
    for (const intent of approvedIntents) {
        if (intent.vfxTriggers?.length) collectedVfx.push(...intent.vfxTriggers);
        if (intent.uiEvent)             collectedUi.push(intent.uiEvent);

        const entity = entities.find(e => e.id === intent.entityId);
        if (!entity) continue;

        switch (intent.type) {

            case 'move': {
                if (!intent.targetPos) break;

                // Eski hücreden çıkış
                const oldCell = grid[entity.position.row]?.[entity.position.col];
                if (oldCell) {
                    const leaveBehavior = CELL_BEHAVIORS[oldCell.type];
                    if (leaveBehavior?.onLeave) {
                        collectToNextTick(leaveBehavior.onLeave(oldCell, entity));
                    }
                }

                // Koordinat güncelleme (saf lojistik — motor matematik yapmaz)
                entity.position = intent.targetPos;

                // Yeni hücreye giriş
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
                entity.physics.z = intent.newZ; // Motor yerçekimini bilmez, değeri eşitler

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
                    const entityBehavior = ENTITY_BEHAVIORS[entity.type];
                    if (entityBehavior?.onLanded) {
                        const landed = entityBehavior.onLanded(entity);
                        if (landed) collectToNextTick(landed);
                    }
                }
                break;
            }

            case 'mutate_entity': {
                // Saf atama — motor matematik yapmaz, hesaplanan değeri behavior sağlar
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
                // Entity'yi işaretle; üst katman (oyun döngüsü) filtreler
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
// YARDIMCI FONKSİYONLAR — saf lojistik, oyun kuralı içermez
// ============================================================

function filterMutualCollisions(intents: ActionIntent[], entities: Entity[]): ActionIntent[] {
    const solidTargetCounts = new Map<string, number>();

    for (const intent of intents) {
        if (!intent.targetPos) continue;
        const entity = entities.find(e => e.id === intent.entityId);
        if (entity?.def.isSolid) {
            const key = `${intent.targetPos.row},${intent.targetPos.col}`;
            solidTargetCounts.set(key, (solidTargetCounts.get(key) ?? 0) + 1);
        }
    }

    return intents.filter(intent => {
        if (!intent.targetPos) return true;
        const me = entities.find(e => e.id === intent.entityId);
        if (!me) return true;
        if (!me.def.isSolid) return true; // Hayalet — çarpışma kuralı yok

        const key = `${intent.targetPos.row},${intent.targetPos.col}`;

        // Kafa kafaya: iki katı nesne aynı kareye
        if ((solidTargetCounts.get(key) ?? 0) > 1) return false;

        // Takas: A → B'nin yeri, B → A'nın yeri (swap)
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
    grid: Cell[][]
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
            const targetCell = grid[targetPos.row]?.[targetPos.col];

            // Harita dışı → red
            if (!targetCell) {
                changedThisPass = true;
                continue;
            }

            // ---- Zemin kontrolü (motor kural bilmez, zemine sorar) ----
            let cellAllows = true;
            const cellBehavior = CELL_BEHAVIORS[targetCell.type];

            if (cellBehavior?.onValidateIntent) {
                cellAllows = cellBehavior.onValidateIntent(targetCell, intent, me);
            } else if (intent.type === 'move' && !targetCell.def.isWalkable) {
                cellAllows = false;
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

            // ---- Zincir bağımlılığı ----
            const blocker = entities.find(e =>
                e.id !== me.id &&
                e.position.row === targetPos.row &&
                e.position.col === targetPos.col &&
                e.def.isSolid
            );

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

        // Motor itme kurallarını bilmez — blocker'ın davranışına sorar
        const blockerBehavior = ENTITY_BEHAVIORS[blocker.type];
        if (!blockerBehavior?.onPushed) continue;

        const response = blockerBehavior.onPushed(blocker, intentEntity, intent.force ?? 0);

        if (response.status === 'accept') {
            pending.push(response.resultingIntent);
            allIntents.push(response.resultingIntent);
            intent.force = response.forceRemaining;
            pushedSomeone = true;
        }
    }

    return pushedSomeone;
}
