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
    z: 0,
    // entity'e özgü alanlar:
    // myField: e.myField,
  }),
),
```

### 6. (İsteğe bağlı) Görsel — `app/src/games/components/GameBoard.tsx`

Entity'yi tahta üzerinde render et.

---

## Yeni Entity Alanı / Özellik Ekleme

Trampoline için `z` (yükseklik) ve `momentum` gibi yeni bir özellik ekleyeceksen şu katmanları değiştirmen gerekir.

### 1. `TickEntity`'e alan ekle — `engine/types.ts`

```typescript
export interface TickEntity {
  // ... mevcut alanlar
  myField?: number;   // ← ekle; opsiyonel ya da zorunlu
}
```

`z` ve `momentum` zaten burada tanımlı — bunları referans al.

### 2. `init.ts`'te alan ata

```typescript
// initTickState içinde entity oluştururken:
z: 0,          // her entity başlangıçta groundda
momentum: undefined,
myField: e.myField ?? 0,
```

### 3. `loop.ts`'te alanı oku/yaz

`runTickLoop` her `step` öncesinde entity'nin alanını okur:

```typescript
// Örnek: z trampolin yayı için her adımda momentum'dan okunur
entity.z = readMomentumZ(entity);
```

Yeni alan loop davranışını etkiliyorsa buraya ekle:
- **Airborne kontrolü:** `entity.z > 0` ise lava, obstacle, `canEnter`, occupancy atlanır.
- **Landing kontrolü:** `prevZ > 0 && entity.z === 0` → landing sideeffect'leri tetiklenir.
- Yeni kural eklemek için bu iki flag'ın yanına yeni `if` blokları yaz.

### 4. `finalize.ts`'te alandan public state'e dönüştür

```typescript
// onFinalize içinde TickEntity → GameObjectState/BoxState
return {
  kind: 'player_state',
  state: {
    ...prevObj,
    myPublicField: tickEntity.myField,
  },
};
```

Public `GameState` alanlarına eklenecekse `types/index.ts`'teki `GameObjectState` veya `BoxState`'i de güncelle.

### 5. Diğer entity'lerin davranışını değiştirme

Yeni alan, başka entity türlerini etkileyecekse (örn. uçan entity'nin üzerinden geçilemez olmasını istiyorsan):
- `onPushed` hook'unda `self` veya `mover`'ın alanını kontrol et.
- `canEnter` hook'unda `ctx.entity.myField` değerine bak.

---

## Hücre Görseli — `app/src/games/components/GameCell.tsx`

### Arka plan + border stili

```typescript
const CELL_STYLE: Record<CellType, React.CSSProperties> = {
  // ...
  my_cell: {
    background: 'rgba(34, 211, 238, 0.12)',          // yarı şeffaf dolgu
    border: '2px solid rgba(34, 211, 238, 0.6)',     // neon border
    boxShadow: 'inset 0 0 14px rgba(34, 211, 238, 0.2), 0 0 8px rgba(34, 211, 238, 0.15)',
  },
};
```

### İkon veya metin overlay

`return (...)` içinde ilgili `{cellType === 'my_cell' && (...)}` bloğunu ekle:

```tsx
{cellType === 'my_cell' && (
  <span
    style={{
      fontSize: cellSize * 0.32,
      color: '#22d3ee',
      textShadow: '0 0 10px rgba(34,211,238,0.9)',
      userSelect: 'none',
    }}
  >
    ⬡  {/* ya da herhangi bir unicode sembol */}
  </span>
)}
```

### Dinamik görsel (örn. conveyorun powered/dim durumu)

`GameCell` props'una yeni flag ekle:

```typescript
interface GameCellProps {
  // ...
  isMyFlag?: boolean;
}
```

Sonra `GameBoard.tsx`'te hücreye prop ilet:

```tsx
<GameCell
  cellType={cell.type}
  cellSize={cs}
  isMyFlag={myCondition}
/>
```

Ve `GameCell` içinde:

```tsx
const style = isMyFlag
  ? { ...baseStyle, opacity: 0.4, filter: 'grayscale(0.5)' }
  : baseStyle;
```

---

## Animasyon Ekleme

### Animasyon katmanları

| Katman | Nerede | Ne yapar |
|---|---|---|
| `Waypoint.z` | `loop.ts` → `animationPaths` | Her adımdaki yüksekliği taşır; render'da scale'e dönüşür |
| `MoveAnimType` | `types/index.ts` + `finalize.ts` | Hareket türünü (ice, teleport…) `GameObject`'e bildirir; farklı spring/easing seçer |
| framer-motion `mvX/mvY/mvScale` | `GameObject.tsx` | Pozisyon + scale'i smooth animate eder |
| framer-motion `animateScope` | `GameObject.tsx` | Rotate/opacity gibi ikincil efektler (inner `div`) |

### A) Z-tabanlı animasyon (scale / yükseklik)

`loop.ts` zaten her `tick.animationPaths[key].push({ ...resolved, z: entity.z })` çağrısında `z`'yi waypoint'e yazıyor. `GameObject.tsx` bunu:

```typescript
const Z_SCALE = 0.08;
// multi-step path döngüsünde:
const targetScale = 1 + (wp.z ?? 0) * Z_SCALE;
fmAnimate(mvScale, targetScale, { duration: STEP_S, delay, ease: 'linear' });
```

şeklinde scale'e dönüştürüyor. `z` değerini behavior'dan ayarlayarak entity otomatik büyür/küçülür.

### B) Yeni `MoveAnimType` ekleme (örn. `'bounce'`)

**1. Tipi genişlet** — `app/src/games/types/index.ts`:

```typescript
export type MoveAnimType = 'portal' | 'teleport' | 'ice' | 'conveyor' | 'normal' | 'bounce';
```

**2. `finalize.ts`'te ata** — `deriveMoveAnimTypes` içine yeni dal:

```typescript
// entity trampoline kullandıysa:
if (entity.momentum?.zProfile) {
  types[entity.id] = 'bounce';
}
```

**3. `GameObject.tsx`'te efekt yaz** — mevcut `if (animType === 'ice' ...)` bloğunun yanına:

```typescript
if (animType === 'bounce' && scope.current) {
  animateScope(
    scope.current,
    { scale: [1, 1.3, 0.85, 1.1, 1] },   // squash-and-stretch
    { duration: delay, ease: 'easeInOut' },
  );
}
```

> `animateScope` inner `div`'i hedef alır — `mvX/mvY/mvScale` outer `motion.div`'i hedef alır. İkisi paralel çalışır, çatışmaz.

### C) Tamamen özel animasyon (sadece belirli bir durum için)

`path` veya `animType` bilgisi yetmiyorsa, `GameObjectState`'e yeni bir flag ekleyebilirsin:

```typescript
export interface GameObjectState {
  // ...
  isAirborne?: boolean;
}
```

`finalize.ts`'te ata, `GameObject.tsx`'te `object.isAirborne` değerine göre farklı animasyon çalıştır.

### D) Hücre animasyonu (CSS keyframe)

Hücre kendisi animate edilecekse (target'taki pulse gibi) `globals.css`'e keyframe ekle:

```css
@keyframes my-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.6; transform: scale(0.92); }
}
.my-cell-pulse {
  animation: my-pulse 1.4s ease-in-out infinite;
}
```

`GameCell.tsx`'te className ver:

```tsx
{cellType === 'my_cell' && (
  <span className="my-cell-pulse" style={{ ... }}>⬡</span>
)}
```

---

## Özet

| Görev | Dosyalar |
|---|---|
| Yeni hücre tipi | `types/index.ts` + `behaviors/myCell.ts` + `behaviors/registry.ts` |
| Hücre görseli | `GameCell.tsx` (`CELL_STYLE` + JSX blok) + `globals.css` (keyframe) |
| Yeni entity özelliği (alan) | `engine/types.ts` (TickEntity) + `engine/init.ts` + `loop.ts` + `finalize.ts` |
| Yeni animasyon türü | `types/index.ts` (MoveAnimType) + `finalize.ts` (deriveMoveAnimTypes) + `GameObject.tsx` |
| Z-tabanlı scale efekti | Behavior'da `momentum.zProfile` doldur → otomatik çalışır |
| Hücre animasyonu (CSS) | `globals.css` keyframe + `GameCell.tsx` className |
