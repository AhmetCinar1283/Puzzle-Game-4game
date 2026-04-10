import type { CellBehavior } from './registry';
import type { BehaviorResult } from '../engine/types';
import { cellTypeToTrampolineDir } from '../positionUtils';
import { getTrampolineConfig } from '../powerSystem';

/**
 * Trampoline: entity'ye havaya çıkış (z) ve kuvvet (force) verir.
 *
 * Eski zProfile parabola sistemi kaldırıldı. Yeni sistem:
 *   z = cfg.steps          → entity cfg.steps adım havada kalır
 *   force = mass × steps   → normal zeminde bu kadar adım gidebilir
 *
 * Loop her adımda z'yi bir azaltır (z--). z 0'a düştüğünde (iniş):
 *   force *= 0.5           → iniş darbeyi yansıtır (kuvvetin yarısı kalır)
 *
 * İnişten sonra davranış:
 *   Normal zemin: force = mass*steps*0.5 → floor(steps/2) adım kayar
 *   Buz:          force > 0 (frictionless) → sonsuza kadar kayar
 *
 * Hava'da (z > 0): entity obstacle, lava, canEnter kurallarını atlar.
 * İniş anında (z: 1→0): crush kontrolü çalışır (altındakileri ezer).
 */
export const trampolineBehavior: CellBehavior = {
  onEnter(ctx): BehaviorResult {
    const { entity, newPosition, cellType, tick } = ctx;

    const launchDir = cellTypeToTrampolineDir(cellType);
    if (!launchDir) return { velocity: null };

    const cfg = getTrampolineConfig(tick.level, newPosition);
    const steps = cfg.steps;
    const mass = entity.mass ?? 1;

    return {
      velocity: launchDir,
      sideEffect: (t) => {
        const e = t.entities.find((x) => x.kind === entity.kind && x.id === entity.id);
        if (!e) return;
        e.force = mass * steps;
        e.z = steps;
        // Eski momentum/zProfile temizle
        e.momentum = undefined;
        // Conveyor cycle guard sıfırla — iniş sonrası conveyor yakalayabilsin
        e._conveyorVisited = undefined;
      },
    };
  },
};
