import type { CellType } from '../../types';
import type { TickState, TickEntity, BehaviorResult, Velocity } from './types';
import { entityKey, removeFromGrid, addToGrid, getOccupantEntity } from './types';
import { DELTA, posEqual } from '../positionUtils';
import { resolveEdgePosition } from '../movementHelpers';
import { pushChainImmediately } from './collision';
import { CELL_BEHAVIORS } from '../behaviors/registry';
import { activateConveyors } from './velocities';
import { buildBehaviorCtx, buildLeaveCtx, buildIdleCtx } from './contextUtils';

const MAX_TICK = 64;

// ─── Force helpers ────────────────────────────────────────────────────────────

function mass(entity: TickEntity): number {
  return entity.mass ?? 1;
}

/**
 * Returns true if entity has enough force to move 1 step.
 * Frictionless cells (ice, airborne): any force > 0 is enough.
 * Normal ground: force must cover the mass cost.
 */
function canMoveWithForce(entity: TickEntity, frictionless: boolean): boolean {
  return frictionless ? entity.force > 0 : entity.force >= mass(entity);
}

/**
 * Deducts movement cost from force after a successful step.
 * Frictionless (ice / airborne): no deduction — force preserved.
 * Normal ground: force -= mass.
 * Returns the new force value.
 */
function deductForce(entity: TickEntity, frictionless: boolean): void {
  if (!frictionless) {
    entity.force -= mass(entity);
    if (entity.force < 0) entity.force = 0;
  }
}

/** Fully stops entity: velocity = null, force = 0, z = 0. */
function stopEntity(entity: TickEntity): void {
  entity.velocity = null;
  entity.force = 0;
  entity.z = 0;
  entity.momentum = undefined; // backwards compat cleanup
}

// ─── Main loop ────────────────────────────────────────────────────────────────

/**
 * Main movement loop — fixpoint: repeats steps until no entity moved.
 *
 * Her step üç fazdan oluşur:
 *   1. activateConveyors — durağan entity'lere conveyor kuvveti ver
 *   2. onIdle fazı       — hâlâ durağan entity'ler için CellBehavior.onIdle
 *   3. Hareket fazı      — velocity'si olan entity'leri birer hücre ilerlet
 *
 * Force tabanlı fizik kuralları:
 *   Zemin adım maliyeti : force -= mass (entity hareket edebilir: force >= mass)
 *   Buz / hava           : force -= 0   (entity hareket edebilir: force > 0)
 *   İniş (z: 1 → 0)     : force *= 0.5 (iniş darbesi — step başında uygulanır)
 *   Elastik çarpışma     : mover.force → box.force (eşit kütle = tam transfer)
 *
 * Z yönetimi (basitleştirilmiş):
 *   Trambolin z = N adım ayarlar. Her adımda z--.
 *   z=1 → adım sonunda z=0: isLanding=true, crush check + force *= 0.5.
 */
export function runTickLoop(tick: TickState): void {
  for (let step = 0; step < MAX_TICK; step++) {
    if (tick.lostReason) break;

    // ── Her step başında pushedBy temizle ────────────────────────────────────
    for (const e of tick.entities) e.pushedBy = undefined;

    // ── Faz 1: Conveyor aktivasyonu ──────────────────────────────────────────
    activateConveyors(tick);

    // ── Faz 2: onIdle — conveyor almayan durağan entity'ler ─────────────────
    {
      const idleSideEffects: Array<(tick: TickState) => void> = [];
      const idleToRemove = new Set<TickEntity>();

      for (const entity of [...tick.entities]) {
        if (entity.velocity !== null) continue;
        if (idleToRemove.has(entity)) continue;
        const cell = tick.grid[entity.position.row]?.[entity.position.col];
        if (!cell) continue;
        const behavior = CELL_BEHAVIORS[cell.type as CellType];
        if (!behavior?.onIdle) continue;

        const ctx = buildIdleCtx(entity, tick);
        const result = behavior.onIdle(ctx);
        if (!result) continue;

        if (result.sideEffect) idleSideEffects.push(result.sideEffect);

        if (result.destroyEntity) {
          removeFromGrid(tick, entity);
          idleToRemove.add(entity);
        } else {
          entity.velocity = result.velocity;
          if (result.velocity !== null && entity.force <= 0) {
            entity.force = mass(entity); // onIdle velocity verdi ama force yoksa 1 adım ver
          }
          if (result.overridePosition) {
            removeFromGrid(tick, entity);
            entity.position = result.overridePosition;
            addToGrid(tick, result.overridePosition, entity);
            tick.animationPaths[entityKey(entity)]?.push({ ...result.overridePosition, z: entity.z });
          }
        }
      }

      for (const fn of idleSideEffects) fn(tick);
      if (idleToRemove.size > 0) {
        tick.entities = tick.entities.filter((e) => !idleToRemove.has(e));
      }
      if (tick.lostReason) break;
    }

    if (!tick.entities.some((e) => e.velocity !== null)) break;

    // ── Faz 3: Hareket ───────────────────────────────────────────────────────
    const toRemove = new Set<TickEntity>();
    const pendingSideEffects: Array<(tick: TickState) => void> = [];
    let movedAny = false;

    // Landing entities go first — their crush check must run before others move away.
    const ordered = [...tick.entities].sort((a, b) => {
      const aLanding = a.z === 1 ? 1 : 0;
      const bLanding = b.z === 1 ? 1 : 0;
      if (bLanding !== aLanding) return bLanding - aLanding;
      return a.id - b.id;
    });

    for (const entity of ordered) {
      if (entity.velocity === null) continue;
      if (toRemove.has(entity)) continue;

      // ── Z yönetimi + iniş ─────────────────────────────────────────────────
      const prevZ = entity.z;
      if (entity.z > 0) entity.z--;
      const isAirborne = prevZ > 0;          // bu adımda havada mı?
      const isLanding = prevZ > 0 && entity.z === 0; // bu adım iniş mi?

      if (isLanding) {
        // İniş darbesi: kuvvetin yarısı kalır
        entity.force = Math.floor(entity.force * 0.5);
      }

      // ── Force kontrolü ────────────────────────────────────────────────────
      // İnmeden sonra force=0 olabilir — havada airborne bayrağı vardı,
      // zemine inerken 0 kalabilir. Bu adım hareket et ama sonra dur.
      const currentCellType = tick.grid[entity.position.row]?.[entity.position.col]?.type as CellType | undefined;
      const currentFrictionless = isAirborne || (CELL_BEHAVIORS[currentCellType ?? 'empty']?.frictionless ?? false);

      if (!canMoveWithForce(entity, currentFrictionless)) {
        entity.velocity = null;
        entity.force = 0;
        continue;
      }

      const vel = entity.velocity;
      const { dRow, dCol } = DELTA[vel];
      const candidate = { row: entity.position.row + dRow, col: entity.position.col + dCol };
      const resolved = resolveEdgePosition(candidate, tick.level);

      // ── Lava edge ────────────────────────────────────────────────────────────
      if (resolved === 'lava') {
        stopEntity(entity);
        if (isAirborne) continue; // havada → kenara güvenli iniş, ölüm yok
        const { halt } = entity.behavior.onLavaEdge(entity, tick, toRemove);
        if (halt) break;
        continue;
      }

      // ── Wall edge ────────────────────────────────────────────────────────────
      if (!resolved) {
        stopEntity(entity);
        continue;
      }

      const targetCell = tick.grid[resolved.row]?.[resolved.col];
      const cellType = (targetCell?.type ?? 'empty') as CellType;

      // ── Obstacle (yerde) ─────────────────────────────────────────────────────
      if (cellType === 'obstacle' && !isAirborne) {
        stopEntity(entity);
        continue;
      }

      // ── canEnter gate (havada atlanır) ───────────────────────────────────────
      const behavior = CELL_BEHAVIORS[cellType];
      if (!isAirborne && behavior?.canEnter) {
        const ctx = buildBehaviorCtx(entity, resolved, targetCell!, cellType, tick);
        if (!behavior.canEnter(ctx)) {
          stopEntity(entity);
          continue;
        }
      }

      // ── Crush kontrolü (iniş anında) ─────────────────────────────────────────
      if (isLanding) {
        const atLanding = tick.entities.filter(
          (e) =>
            !(e.kind === entity.kind && e.id === entity.id) &&
            posEqual(e.position, resolved) &&
            !toRemove.has(e),
        );
        for (const target of atLanding) {
          if (target.behavior.isDestructible) {
            removeFromGrid(tick, target);
            toRemove.add(target);
          } else {
            tick.lostReason = 'crushed';
          }
        }
        if (tick.lostReason) break;
      }

      // ── Occupancy check (yerde) ──────────────────────────────────────────────
      if (!isAirborne) {
        const occupant = getOccupantEntity(tick, resolved, entity.id, toRemove);
        if (occupant) {
          const result = occupant.behavior.onPushed(occupant, entity, tick, toRemove);
          switch (result.outcome) {
            case 'push_succeeded':
              break;
            case 'push_blocked':
              stopEntity(entity);
              continue;
            case 'mutual_stop':
              stopEntity(entity);
              stopEntity(occupant);
              continue;
            case 'occupant_moving':
              continue; // mover velocity korur, fixpoint retry
          }
        }
      }

      // ── onLeave ──────────────────────────────────────────────────────────────
      {
        const leavingCell = tick.grid[entity.position.row]?.[entity.position.col];
        const leavingBehavior = leavingCell ? CELL_BEHAVIORS[leavingCell.type as CellType] : undefined;
        if (leavingBehavior?.onLeave) {
          const leaveCtx = buildLeaveCtx(entity, resolved, tick);
          const leaveResult = leavingBehavior.onLeave(leaveCtx);
          if (leaveResult?.sideEffect) pendingSideEffects.push(leaveResult.sideEffect);
        }
      }

      // ── Move ──────────────────────────────────────────────────────────────────
      removeFromGrid(tick, entity);
      entity.position = resolved;
      addToGrid(tick, resolved, entity);
      const key = entityKey(entity);
      tick.animationPaths[key].push({ ...resolved, z: entity.z });
      movedAny = true;

      // ── onEnter dispatch (havada atlanır) ─────────────────────────────────────
      let resultVelocity: Velocity = null;
      if (!isAirborne && behavior) {
        const ctx = buildBehaviorCtx(entity, resolved, targetCell!, cellType, tick);
        const result: BehaviorResult = behavior.onEnter(ctx);

        // Teleporter: exit'te box varsa önce it
        if (result.exitBoxToPush) {
          result.exitBoxToPush.pushedBy = entity;
          const pushed = pushChainImmediately(result.exitBoxToPush, vel, tick, toRemove);
          if (!pushed) {
            result.exitBoxToPush.pushedBy = undefined;
            stopEntity(entity);
            continue;
          }
        }

        if (result.sideEffect) pendingSideEffects.push(result.sideEffect);

        if (result.destroyEntity) {
          stopEntity(entity);
          removeFromGrid(tick, entity);
          toRemove.add(entity);
          continue;
        }

        if (result.overridePosition) {
          removeFromGrid(tick, entity);
          entity.position = result.overridePosition;
          addToGrid(tick, result.overridePosition, entity);
          tick.animationPaths[key].push({ ...result.overridePosition, z: entity.z });
        }

        resultVelocity = result.velocity;
      }
      // Havada: velocity korunur (momentum devam eder)
      else if (isAirborne) {
        resultVelocity = vel;
      }

      // ── Force deduction + devam kararı ────────────────────────────────────────
      const destFrictionless = isAirborne || (behavior?.frictionless ?? false);
      deductForce(entity, destFrictionless);

      if (resultVelocity !== null) {
        // Behavior açıkça yön verdi (conveyor, ice, trampoline vb.)
        entity.velocity = resultVelocity;
        // Eğer behavior yön verdi ama force azaldıysa 0 → dur
        if (!canMoveWithForce(entity, destFrictionless)) {
          entity.velocity = null;
          entity.force = 0;
        }
      } else {
        // Behavior null döndürdü (normal hücre, dur) — ama force varsa devam et
        const stillHasForce = canMoveWithForce(entity, destFrictionless);
        if (stillHasForce) {
          entity.velocity = vel; // aynı yönde devam
        } else {
          entity.velocity = null;
          entity.force = 0;
        }
      }
    }

    for (const fn of pendingSideEffects) fn(tick);

    if (toRemove.size > 0) {
      tick.entities = tick.entities.filter((e) => !toRemove.has(e));
    }

    if (!movedAny) break;
    if (tick.lostReason) break;
  }
}
