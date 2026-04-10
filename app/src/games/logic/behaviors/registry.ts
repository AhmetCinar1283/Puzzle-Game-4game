import type { CellType } from '../../types';
import type { BehaviorContext, BehaviorResult, LeaveContext, IdleContext } from '../engine/types';

// ─── CellBehavior ─────────────────────────────────────────────────────────────

/**
 * Bir hücrenin entity'lerle etkileşimini tanımlar. Üç lifecycle hook'u var:
 *
 * canEnter  — entity girmeden ÖNCE çağrılır. false döndürürse entity durur,
 *             onEnter çağrılmaz.
 *
 * onEnter   — entity hücreye girdikten SONRA çağrılır. Entity'nin yeni hızını
 *             ve yan etkileri döndürür.
 *
 * onLeave   — entity hücreden AYRILMADAN hemen önce çağrılır.
 *             Entity'yi durduramaz; yalnızca yan etki için kullanılır
 *             (ör. sayaç azalt, toggle sıfırla, customData güncelle).
 *
 * onIdle    — Her step'te, hâlâ durağan (velocity === null) olan entity için
 *             çağrılır. activateConveyors'dan SONRA, hareket fazından ÖNCE.
 *             BehaviorResult döndürerek entity'ye velocity verebilir veya
 *             void döndürerek durağan bırakabilir.
 *
 * Behavior yazarları için kurallar:
 *  - TickState'i doğrudan mutate etme. BehaviorResult.sideEffect thunk'ını kullan.
 *    (İstisna: onLeave ve onIdle içinde ctx.cell.customData doğrudan değiştirilebilir —
 *     bu, sadece o hücrenin kendi verisi olduğu için güvenlidir.)
 *  - canEnter ve onEnter saf (pure) tutulmalı: aynı context her zaman aynı sonucu verir.
 *  - Hız döndürürken: hareketi sürdürmek için gelen ctx.entity.velocity'i döndür,
 *    durdurmak için null döndür, yönlendirmek için farklı bir Direction döndür.
 */
export interface CellBehavior {
  /**
   * Entity girmeden önce kapı kontrolü. false döndürürse entity durur,
   * velocity temizlenir. ctx.targetCell.occupantIds veya customData'ya bakılabilir.
   * Atlanırsa giriş her zaman izinlidir (engine obstacle ve occupancy kontrollerini
   * bağımsız olarak yapar).
   */
  canEnter?(ctx: BehaviorContext): boolean;

  /**
   * Sürtünme katsayısı. true = sürtünmesiz (buz, hava).
   * Engine, entity bu hücrede hareket ederken force azaltmaz (force -= 0).
   * false/undefined = normal zemin (force -= mass her adımda).
   * Entity bu hücredeyken hareket koşulu: frictionless ? force > 0 : force >= mass
   */
  frictionless?: boolean;

  /** Entity hücreye girdikten sonra. Yeni hız ve yan etkileri döndürür. */
  onEnter(ctx: BehaviorContext): BehaviorResult;

  /**
   * Entity hücreden ayrılmadan hemen önce çağrılır.
   * Entity'yi durduramaz; yalnızca yan etki (customData, TickState sideEffect) için.
   * Opsiyonel sideEffect thunk döndürülebilir — tüm entity'ler işlendikten sonra uygulanır.
   */
  onLeave?(ctx: LeaveContext): { sideEffect?: (tick: import('../engine/types').TickState) => void } | void;

  /**
   * Her step'te durağan entity için çağrılır (velocity === null, conveyor aktivasyonundan sonra).
   * void döndürürse entity durağan kalır.
   * BehaviorResult döndürürse: velocity entity'ye set edilir, sideEffect/destroyEntity işlenir.
   */
  onIdle?(ctx: IdleContext): BehaviorResult | void;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

import { iceBehavior } from './ice';
import { conveyorBehavior } from './conveyor';
import { teleporterBehavior } from './teleporter';
import { directionToggleBehavior } from './directionToggle';
import { forbiddenBehavior } from './forbidden';
import { powerNodeBehavior } from './powerNode';
import { trampolineBehavior } from './trampoline';

/**
 * Maps each CellType to its behavior module.
 * Cell types omitted here (empty, obstacle, target_1/2) cause entities to stop —
 * the tick loop treats a missing entry as { velocity: null }.
 *
 * To add a new cell type: create a behavior module and add one line here.
 */
export const CELL_BEHAVIORS: Partial<Record<CellType, CellBehavior>> = {
  ice: iceBehavior,

  conveyor_up: conveyorBehavior,
  conveyor_down: conveyorBehavior,
  conveyor_left: conveyorBehavior,
  conveyor_right: conveyorBehavior,

  teleporter_in_A: teleporterBehavior,
  teleporter_in_B: teleporterBehavior,
  teleporter_in_C: teleporterBehavior,
  teleporter_out_A: teleporterBehavior,
  teleporter_out_B: teleporterBehavior,
  teleporter_out_C: teleporterBehavior,

  direction_toggle: directionToggleBehavior,
  forbidden: forbiddenBehavior,
  power_node: powerNodeBehavior,

  trampoline_up: trampolineBehavior,
  trampoline_down: trampolineBehavior,
  trampoline_left: trampolineBehavior,
  trampoline_right: trampolineBehavior,
};
