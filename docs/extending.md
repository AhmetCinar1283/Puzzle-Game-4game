# Yeni Hücre ve Nesne Ekleme

## Yeni Hücre Tipi

### 1. Tipi tanımla — `app/src/games/types/index.ts`

```typescript
export type CellType =
  | ...
  | 'my_cell';  // ← ekle
```

### 2. Behavior dosyası oluştur — `app/src/games/logic/behaviors/myCell.ts`

```typescript
import type { CellBehavior } from './registry';

export const myCellBehavior: CellBehavior = {
  onEnter(ctx) {
    // ctx.entity   → hareket eden entity (TickEntity)
    // ctx.tick     → mevcut tick state
    // ctx.newPosition → entity'nin girdiği hücre konumu

    // Örnekler:
    // Entity durur:         return { velocity: null }
    // Entity kayar:         return { velocity: ctx.entity.velocity }
    // Entity yönlenir:      return { velocity: 'up' }
    // Entity yok edilir:    return { velocity: null, destroyEntity: true }
    // Tick state mutasyonu: return { velocity: null, sideEffect: (tick) => { ... } }

    return { velocity: null };
  },
};
```

**Kurallar:**
- `TickState`'i direkt mutate etme; `sideEffect` thunk'ı kullan.
- `ctx.entity.behavior.isUserControlled` → player mı kontrol et (`kind` kullanma).

### 3. Registry'e ekle — `app/src/games/logic/behaviors/registry.ts`

```typescript
import { myCellBehavior } from './myCell';

export const CELL_BEHAVIORS: Partial<Record<CellType, CellBehavior>> = {
  // ...
  my_cell: myCellBehavior,
};
```

### 4. (İsteğe bağlı) Görsel — `app/src/games/components/GameCell.tsx`

Hücrenin tahta üzerinde nasıl görüneceğini tanımla.

### 5. (İsteğe bağlı) Editörde göster

Editör araç paletine ekle.

---

## Yeni Entity Tipi (Nesne)

### 1. Tipi tanımla

`app/src/games/types/index.ts`'e yeni state tipi ekle:

```typescript
export interface MyEntityState {
  id: number;
  position: Position;
  // entity'e özgü alanlar...
}
```

`GameState`'e ekle:

```typescript
export interface GameState {
  // ...
  myEntities: MyEntityState[];
}
```

### 2. Behavior dosyası oluştur — `app/src/games/logic/engine/entities/myEntity.ts`

```typescript
import type { EntityBehavior, FinalizeContext, FinalizeResult, OnPushedResult, TickEntity, TickState } from '../types';

export const myEntityBehavior: EntityBehavior = {
  // ── Flags ──
  isUserControlled: false,          // kullanıcı girdisiyle hareket etmez
  participatesInOrderResolution: false,
  processingPriority: 1,            // 0 = player önce, 1 = box/diğer sonra
  isDestructible: true,             // lava/forbidden ile yok edilebilir
  generatesTrail: false,            // iz bırakmaz
  isPushChainRoot: true,            // durağanken itilebilir (box gibi)

  // ── Hooks ──
  onPushed(self, mover, tick, toRemove): OnPushedResult {
    // Durağan itilebilir nesne örneği (box gibi):
    if (self.velocity !== null) return { outcome: 'occupant_moving' };
    // Özel mantık: örn. sadece belirli yönden itilebilir
    return { outcome: 'push_blocked' };
  },

  onLavaEdge(self, _tick, toRemove): { halt: boolean } {
    toRemove.add(self);   // nesneyi yok et
    return { halt: false }; // oyunu bitirme (player'da true olur)
  },

  onFinalize(ctx: FinalizeContext): FinalizeResult {
    const { tickEntity, prevState } = ctx;
    if (!tickEntity) return { kind: 'destroyed' };
    // FinalizeResult'a yeni bir kind eklemen gerekebilir (aşağıya bak)
    return { kind: 'destroyed' }; // placeholder
  },
};
```

### 3. FinalizeResult'a yeni kind ekle — `engine/types.ts`

```typescript
export type FinalizeResult =
  | { kind: 'player_state'; state: GameObjectState; trailEntry?: Position }
  | { kind: 'box_state'; state: BoxState }
  | { kind: 'my_entity_state'; state: MyEntityState }  // ← ekle
  | { kind: 'destroyed' };
```

### 4. `finalize.ts`'te topla — `engine/finalize.ts`

`finalizeTickState` içindeki entity döngüsüne bir dal ekle:

```typescript
} else if (result.kind === 'my_entity_state') {
  newMyEntities.push(result.state);
}
```

Ve return'de `GameState`'e ekle:

```typescript
return {
  ...prev,
  myEntities: newMyEntities,
  // ...
};
```

### 5. Entity'yi init'te oluştur — `engine/init.ts`

```typescript
import { myEntityBehavior } from './entities/myEntity';

// initTickState içinde:
...state.myEntities.map(
  (e): TickEntity => ({
    kind: 'my_entity',   // animationPaths key'i: "my_entity:1"
    id: e.id,
    position: { ...e.position },
    velocity: null,
    behavior: myEntityBehavior,
    // entity'e özgü alanlar:
    // myField: e.myField,
  }),
),
```

### 6. (İsteğe bağlı) Görsel — `app/src/games/components/GameBoard.tsx`

Entity'yi tahta üzerinde render et.

---

## Özet

| | Hücre | Entity |
|---|---|---|
| Yeni dosya | `behaviors/myCell.ts` | `entities/myEntity.ts` |
| Kayıt | `behaviors/registry.ts` 1 satır | `engine/init.ts` 1 blok |
| Engine değişikliği | **Yok** | **Yok** |
| Ek değişiklik | Görsel (GameCell) | `types.ts` + `finalize.ts` + görsel |
