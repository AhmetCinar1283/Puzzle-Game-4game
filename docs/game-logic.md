# Game Logic

## Architecture

### Client-only Pages

All pages that interact with the game or Dexie are `'use client'` components. `useSearchParams` usage is always wrapped in `<Suspense>`.

### State Flow

```
useGameEngine (hook)
  └── useReducer(gameReducer, level, initialStateFromLevel)
        └── processMoveStep (pure) — momentum-based tick loop
              ├── initTickState      — build TickState, compute poweredCells (BFS)
              ├── resolvePlayerOrder — Kahn's topological sort for simultaneous moves
              │     └── head-on swap detection → both players stopped
              ├── assignInitialVelocities — assign Direction | null per player
              │     └── two-player box conflict → both blocked
              └── runTickLoop  (while any entity has velocity && tick < MAX_TICK=64)
                    ├── activateConveyors — stationary entities on active conveyors get velocity
                    ├── for each entity with velocity (players first, then boxes):
                    │     ├── resolveEdgePosition → lava (die/destroy) | null (wall-stop) | Position
                    │     ├── obstacle check → stop
                    │     ├── occupancy check → pushChainImmediately (box) or both-stop (player)
                    │     ├── move entity, append to animationPaths
                    │     └── CELL_BEHAVIORS[cell]?.onEnter(ctx) → BehaviorResult
                    │           · ice            → preserve velocity (slide continues)
                    │           · conveyor_*     → set velocity to conveyor direction
                    │           · teleporter_*   → overridePosition to exit, carry velocity
                    │           · direction_toggle → flip mode (sideEffect)
                    │           · power_node     → add to poweredPlayers (sideEffect)
                    │           · forbidden      → lostReason (player) / destroyEntity (box)
                    │           · (none)         → stop
                    └── finalizeTickState
                          ├── rebuild objects/boxes from TickEntities
                          ├── update trail (start positions of moved players)
                          ├── trail collision check
                          ├── win condition check
                          └── deriveMoveAnimTypes (backward compat for sound system)
```

All game logic lives in `app/src/games/logic/` as pure functions with no React dependency.

### Logic Files

```
app/src/games/logic/
├── positionUtils.ts      posKey, DELTA, conveyor/teleporter cell helpers
├── powerSystem.ts        computePoweredCells — BFS power propagation
├── movementHelpers.ts    resolveDirection, resolveEdgePosition, addToTrail, checkWinCondition, applyMoveToObject
├── movement.ts           shim — re-exports processMoveStep from engine/tick.ts
├── gameReducer.ts        initialStateFromLevel, gameReducer
│
├── engine/
│   ├── types.ts          TickState, TickEntity, Velocity, BehaviorContext, BehaviorResult
│   ├── tick.ts           processMoveStep — main entry point (dependency sort + tick loop)
│   └── collision.ts      collectPushChain + pushChainImmediately (atomic box chain push)
│
└── behaviors/
    ├── registry.ts       CellBehavior interface + CELL_BEHAVIORS map
    ├── ice.ts            preserve velocity → slide continues
    ├── conveyor.ts       override velocity with conveyor direction + cycle guard
    ├── teleporter.ts     overridePosition to exit, carry velocity + cycle guard
    ├── directionToggle.ts flip entity mode via sideEffect
    ├── forbidden.ts      destroyEntity (box) or lostReason='forbidden' (player)
    └── powerNode.ts      add player to poweredPlayers via sideEffect
```

### Extending with New Cell Types

Add a new cell type in **3 steps**:
1. Add the string literal to `CellType` in `types/index.ts`
2. Create `logic/behaviors/myCellType.ts` exporting a `CellBehavior` object
3. Add one entry to `CELL_BEHAVIORS` in `logic/behaviors/registry.ts`

No changes to the engine (`tick.ts`) are needed.

## Cell Types & Behaviour

| Cell | Behaviour |
|---|---|
| `empty` | Walkable — entity stops |
| `obstacle` | Blocks movement — entity stays in place |
| `forbidden` | Walkable, but landing triggers `phase = 'lost'` (reason: `'forbidden'`); box silently destroyed |
| `target_1` / `target_2` | Win destination for each player object |
| `direction_toggle` | On entry, toggles the landing entity's mode (normal ↔ reversed) |
| `ice` | Entity keeps its velocity → slides until hitting a non-ice or blocking cell |
| `power_node` | Player stepping here becomes "powered"; their trail acts as an electric cable |
| `conveyor_up/down/left/right` | On entry (and each tick while standing still): entity velocity set to conveyor direction |
| `teleporter_in_A/B/C` | Teleports entity to paired `teleporter_out_A/B/C`; blocked exit = no teleport |
| `teleporter_out_A/B/C` | Exit point; reverse-teleport back to `teleporter_in` if entity moves into it |

**Ice rules (updated):** Lava edges kill during any slide — there is no longer a "lava acts as wall on ice" exception. The tick loop handles lava identically for all movement types.

**Teleporter rules:** Exit cell blocked by any entity → entity stays at entrance. Cycle guard: each teleporter group (A/B/C) can be used at most once per move resolution. Velocity is carried through: an entity arriving at the exit cell with velocity will continue moving next tick (enabling teleporter→ice or teleporter→conveyor chains).

**Conveyor rules:** `activateConveyors()` runs every tick and gives velocity to stationary entities already on active conveyors. Cycle guard (`_conveyorVisited`) prevents infinite conveyor loops. Player with velocity running into a box on a conveyor triggers an immediate chain push.

## Edge Behaviour

Each of the 4 edges is independently configured in the level JSON:
- `wall` — movement stopped (entity stays)
- `portal` — entity wraps to the opposite edge (purple border `#9333ea`)
- `lava` — any movement beyond this edge → `phase = 'lost'` (reason: `'lava_edge'`), red border `#ef4444`

## Boxes (Sokoban mechanic)

Boxes are defined in `LevelData.initialBoxes` and tracked in `GameState.boxes` as `BoxState[]`.

- Players push boxes by moving into them
- **Chain push** (`pushChainImmediately` in `engine/collision.ts`): pushing box A into box B moves the whole chain atomically (back-to-front). If any link is blocked, the entire push fails — player stays.
- Two players pushing the same box → both blocked (detected in `assignInitialVelocities` pre-pass)
- `requiresPower: true` → box only pushable when its cell is in `poweredCells`
- Box pushed onto `forbidden` or off a `lava` edge → silently destroyed
- Boxes receive velocity from ice/conveyor behaviors exactly like players — a pushed box that lands on ice continues sliding in subsequent ticks

## Dependency Resolution (Simultaneous Moves)

Both players move every turn. `resolvePlayerOrder` (Kahn's topological sort) ensures correct ordering:

- **Normal**: if no dependencies, both players get velocity independently
- **Follow-through**: if P1 wants to move to P2's cell AND P2 is also moving, P2 is processed first (P2 vacates → P1 proceeds)
- **Head-on swap**: P1→P2.pos and P2→P1.pos simultaneously → both blocked (detected before sort)
- **Blocked**: P1 wants P2's cell but P2 is not moving → P1 blocked

## Power System

- `power_node` cell: player stepping on it is added to `poweredPlayers: number[]`
- Powered players' trail positions are always tracked; trail renders an electric amber overlay
- `computePoweredCells` BFS: seeds = all `power_node` positions + all trail cells of powered players
- BFS extends to adjacent: conveyors in `conveyorPowerRequired`, boxes with `requiresPower: true`
- Teleporter propagation: powered `teleporter_in_X` → paired `teleporter_out_X` also powered

## Trail Collision (optional per level)

When `trailCollision: true` is set in `LevelData`:
- Trail positions are tracked in `GameState.trail`
- Trail overlays are rendered on the board (emerald for P1, sky for P2)
- Landing on the opponent's trail → `phase = 'lost'` (reason: `'trail'`)
- Checked in `finalizeTickState` after all movement resolves

## GameState Shape

```typescript
{
  level: LevelData                       // immutable level config
  objects: GameObjectState[]             // mutable runtime state per player
  boxes: BoxState[]                      // pushable box positions
  poweredPlayers: number[]               // player IDs who stepped on power_node
  phase: 'playing' | 'won' | 'lost'
  moveCount: number
  trail: Record<number, Position[]>      // objectId → visited positions
  lostReason?: 'forbidden' | 'lava_edge' | 'trail'
  moveAnimTypes?: Record<number, MoveAnimType>  // for sound system (derived)
  animationPaths?: Record<string, Position[]>   // "player:1"/"box:2" → waypoints
}
```

`animationPaths` contains every position each entity visited during the tick loop. `GameObject` and `GameBoxObject` consume it to animate step-by-step through each waypoint (80 ms per cell for multi-step paths).

## GameShell Props

```typescript
interface GameShellProps {
  level: LevelData;
  onNextLevel?: () => void;  // if provided, "Next Level" button shown in WinOverlay
  source?: 'preset' | 'user';
}
```

## Object IDs & Visual Mapping

- Object `id: 1` → neon emerald `#00ff88`, grid cell `target_1`
- Object `id: 2` → neon sky `#00c4ff`, grid cell `target_2`

## Last Played Level

- `game/page.tsx` saves `lastPlayedLevelId` and `lastPlayedSource` (`'preset'` | `'user'`) to `localStorage` after loading a level.
- Main menu Play button reads these values and navigates directly to the last played level. Falls back to `/levels` if not set.
- `<GameShell key={level.id}>` forces remount on level change.
