import type { CellBehavior } from './registry';
import type { BehaviorResult } from '../engine/types';
import { cellTypeToConveyorDir, posKey } from '../positionUtils';
import { canConveyorFire, decrementConveyorUse, getConveyorConfig } from '../powerSystem';

/**
 * Conveyor: entity'ye yön ve kuvvet verir.
 *
 * force = mass × cfg.steps
 *   Entity conveyor'a girince ya da durağanken aktivasyon alınca bu değer set edilir.
 *   Normal zeminde her adım force -= mass olduğundan entity tam cfg.steps adım ilerler.
 *   Buz üzerinde geçiyorsa force azalmaz; buz bitince kalan kuvvetle devam eder.
 *
 * Cycle guard: aynı conveyor hücresi entity başına sadece 1 kez aktive edilir.
 */
export const conveyorBehavior: CellBehavior = {
  onEnter(ctx): BehaviorResult {
    const { entity, newPosition, cellType, tick } = ctx;

    const convDir = cellTypeToConveyorDir(cellType);
    if (!convDir) return { velocity: null };

    if (!canConveyorFire(newPosition, tick.level, tick.poweredCells, tick.conveyorRemainingUses)) {
      return { velocity: null };
    }

    const key = posKey(newPosition);
    if (entity._conveyorVisited?.has(key)) {
      return { velocity: null };
    }

    const cfg = getConveyorConfig(tick.level, newPosition);
    const mass = entity.mass ?? 1;

    return {
      velocity: convDir,
      sideEffect: (t) => {
        const e = t.entities.find((x) => x.kind === entity.kind && x.id === entity.id);
        if (!e) return;
        if (!e._conveyorVisited) e._conveyorVisited = new Set();
        e._conveyorVisited.add(key);
        // force = mass × steps: normal zeminde tam cfg.steps adım gider
        e.force = (e.mass ?? 1) * cfg.steps;
        decrementConveyorUse(newPosition, t.level, t.conveyorRemainingUses);
        // Eski momentum'u temizle (geçiş dönemi uyumu)
        e.momentum = undefined;
      },
    };
  },
};
