import { Direction, Position, ActionIntent, EntityTrait } from "./types";

export interface PhysicsState {
  direction: Direction;
  force: number;
  z: number;
}

export interface EntityDef {
  mass: number;
  resistance: number;
  isSolid: boolean;
}

export type EntityTypes = 'player' | 'box';

// SAF VERİ — JSON'a çevrilebilir, behavior içermez.
// Motor, davranışları her zaman ENTITY_BEHAVIORS[entity.type] registry'sinden okur.
export interface Entity {
  id: number;
  type: EntityTypes;
  position: Position;

  physics: PhysicsState;
  def: EntityDef;

  traits: Set<EntityTrait>;
  isElectrified: boolean;

  // Nesneye özel diğer state'ler için serbest alan
  customData: Record<string, unknown>;
}

export type PushResponse =
  | {
      status: 'accept';
      resultingIntent: ActionIntent; // İtilen nesnenin fırlattığı yeni niyet (Örn: move)
      forceRemaining: number;        // İten kişiye kalan güç
    }
  | { status: 'reject' }
  | { status: 'pass_through' };

// EntityBehavior arayüzü burada yaşamaya devam eder;
// sadece Entity'nin içine gömülmez — registry'de kullanılır.
export interface EntityBehavior {
  onPushed?: (self: Entity, pusher: Entity, appliedForce: number) => PushResponse;
  onCrushed?: (self: Entity, crusher: Entity) => ActionIntent[] | null;
  onTick?: (self: Entity) => ActionIntent[];
  onLanded?: (self: Entity) => ActionIntent[] | null;
}