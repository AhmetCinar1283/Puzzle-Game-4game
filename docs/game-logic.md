# Game Logic

## Architecture

### Client-only Pages

All pages that interact with the game or Dexie are `'use client'` components. `useSearchParams` usage is always wrapped in `<Suspense>`.

### State Flow

```
useGameEngine (hook)
  └── useReducer(gameReducer, level, initialStateFromLevel)
        └── processMoveStep (pure) — 16-step pipeline
              ├── computePoweredCells (BFS from power_node + powered trails)
              ├── Pass 1: raw player desired positions (ignoring boxes)
              ├── Pass 2: resolve box pushes; conflicts → both players stay
              ├── Pass 3: finalize player positions
              ├── Lava edge check → lost
              ├── Ice slide (resolveIceSlide) per player
              ├── Teleport players (applyEntityTeleport)
              ├── Post-teleport ice slide
              ├── Update trails (always for poweredPlayers; otherwise gated on trailCollision)
              ├── Apply side-effects: power_node, direction_toggle, lock
              ├── Apply box pushes; boxes on lava/forbidden → destroyed
              ├── Conveyor phase (processConveyors) — moves both players and boxes
              ├── Recompute poweredCells
              ├── Forbidden check → lost
              ├── Trail collision check → lost
              ├── Win condition check
              └── Assemble new state with boxes, poweredPlayers
```

All game logic lives in `app/src/games/logic/` as pure functions with no React dependency.

### Logic Files

| File | Purpose |
|---|---|
| `movement.ts` | `processMoveStep` — main per-turn pipeline |
| `positionUtils.ts` | `posKey`, `DELTA`, conveyor/teleporter cell helpers |
| `powerSystem.ts` | `computePoweredCells` — BFS power propagation |
| `iceSlide.ts` | `resolveIceSlide` — slides entity to end of ice run |
| `teleporter.ts` | `applyEntityTeleport` — teleports entity if exit is free |
| `boxPhysics.ts` | `computeBoxChainPush`, `computeBoxPush`, `processConveyors` |
| `gameReducer.ts` | `initialStateFromLevel` — builds initial `GameState` |

### Movement Resolution Order (critical)

All new positions are computed **before** any are applied. This prevents turn-order dependency between objects. Then side-effects (mode toggle, lock, trail) are applied per-object.

## Cell Types & Behaviour

| Cell | Behaviour |
|---|---|
| `empty` | Walkable |
| `obstacle` | Blocks movement — object stays in place |
| `forbidden` | Walkable, but landing on it triggers `phase = 'lost'` (reason: `'forbidden'`) |
| `target_1` / `target_2` | Win destination for each object |
| `direction_toggle` | On entry, toggles the landing object's mode (normal ↔ reversed) |
| `ice` | Entity slides in move direction until hitting a non-ice or blocking cell |
| `power_node` | Player stepping here becomes "powered"; their trail acts as an electric cable |
| `conveyor_up/down/left/right` | After all movement: pushes players and boxes 1 step in conveyor direction |
| `teleporter_in_A/B/C` | Teleports entity to paired `teleporter_out_A/B/C`; blocked exit = no teleport |
| `teleporter_out_A/B/C` | Exit point for a teleporter pair |

**Ice rules:** During a slide, lava edges act as walls (no death). Lava death only on the first intentional step.

**Teleporter rules:** If the exit cell is occupied by a player, box, or obstacle → entity stays at the `teleporter_in` cell (no teleport this turn). Power cables (powered player trails) propagate through teleporters.

**Conveyor rules:** Conveyors may optionally require power (`conveyorPowerRequired` in `LevelData`). An unpowered required conveyor is inactive. Batch order-independent resolution with per-entity cycle detection.
- Player on conveyor reaching a box → chain push; if push fails, player stays (no overlap)
- Box on conveyor reaching a player → player is pushed 1 step; if player can't move, box stays (no overlap)
- Box on conveyor reaching another box → conveyor stops (no chain push from conveyors, only from player actions)

## Edge Behaviour

Each of the 4 edges is independently configured in the level JSON:
- `wall` — movement into that edge is blocked (object stays)
- `portal` — object wraps to the opposite edge (purple border `#9333ea`)
- `lava` — object tries to move beyond this edge → `phase = 'lost'` (reason: `'lava_edge'`), red border `#ef4444`

## Boxes (Sokoban mechanic)

Boxes are defined in `LevelData.initialBoxes` and tracked in `GameState.boxes` as `BoxState[]`.

- Players push boxes by moving into them; box slides 1 step in the same direction
- **Chain push:** pushing box A into box B moves both (recursively); whole chain fails if any box is blocked
- Two players pushing the same box → conflict → both players stay, no boxes move
- `requiresPower: true` on a box → box can only be pushed when its cell is powered
- Box pushed onto `forbidden` or off a `lava` edge → silently destroyed (no game-over)
- Boxes slide on ice when pushed onto it; boxes can teleport through teleporters

**`computeBoxChainPush`** in `boxPhysics.ts` is the recursive chain push implementation.

## Power System

- `power_node` cell: player stepping on it is added to `poweredPlayers: number[]`
- Powered players' trail positions are always tracked; trail renders an electric amber overlay
- `computePoweredCells` BFS: seeds = all `power_node` positions + all trail cells of powered players
- BFS extends through adjacent: conveyors in `conveyorPowerRequired`, boxes with `requiresPower: true`
- Teleporter propagation: powered `teleporter_in_X` → paired `teleporter_out_X` also powered

## Trail Collision (optional per level)

When `trailCollision: true` is set in `LevelData`:
- Trail positions are tracked in `GameState.trail`
- Trail overlays are rendered on the board (emerald for P1, sky for P2)
- Landing on the opponent's trail → `phase = 'lost'` (reason: `'trail'`)
- Objects can freely step on their **own** trail

## GameState Shape

```typescript
{
  level: LevelData                     // immutable level config
  objects: GameObjectState[]           // mutable runtime state per object
  boxes: BoxState[]                    // pushable box positions
  poweredPlayers: number[]             // player IDs who stepped on power_node
  phase: 'playing' | 'won' | 'lost'
  moveCount: number
  trail: Record<number, Position[]>    // objectId → visited positions
  lostReason?: 'forbidden' | 'lava_edge' | 'trail'
}
```

## GameShell Props

```typescript
interface GameShellProps {
  level: LevelData;
  onNextLevel?: () => void;  // if provided, "Next Level" button shown in WinOverlay
}
```

`GameShell` no longer self-discovers next level from a static array. The parent (game page) handles Dexie lookup and passes the callback.

## Teleporter Behaviour (Bidirectional)

- **Forward (teleporter_in → teleporter_out):** Always applies when entity is on a `teleporter_in_X` cell.
- **Reverse (teleporter_out → teleporter_in):** Applies when entity **moved into** a `teleporter_out_X` cell this turn (i.e. `prevPos ≠ newPos`). If the entity was already on the exit and got blocked (didn't move), reverse teleport does NOT trigger.
- `positionUtils.ts` exports `teleporterOutToIn()` for the reverse mapping.
- `applyEntityTeleport` accepts `prevPos: Position | null = null`.

## Object IDs & Visual Mapping

- Object `id: 1` → neon emerald `#00ff88`, grid cell `target_1`
- Object `id: 2` → neon sky `#00c4ff`, grid cell `target_2`

## Last Played Level

- `game/page.tsx` saves `lastPlayedLevelId` and `lastPlayedSource` (`'preset'` | `'user'`) to `localStorage` after loading a level.
- Main menu Play button reads these values and navigates directly to the last played level. Falls back to `/levels` if not set.
- `<GameShell key={level.id}>` forces remount on level change.
