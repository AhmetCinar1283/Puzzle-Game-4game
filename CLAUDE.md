# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Turbopack, default in Next.js 16)
npm run build    # Production build
npm run lint     # ESLint (Next.js 16 uses ESLint CLI, not next lint)
npx tsc --noEmit # Type-check without emitting files
```

No test framework is set up yet.

## What This Is

**Know & Conquer** — a grid-based puzzle game built with Next.js 16 App Router. The player presses arrow keys (or D-pad) to move two objects simultaneously across a grid. Each object has an independent movement mode (`normal` = moves in key direction, `reversed` = moves in opposite direction). The goal is to land both objects on their respective target cells at the same time.

## Pages

| Route | Description |
|---|---|
| `/` | Main menu (neon style) |
| `/game?id=X` | Play level X from Dexie DB |
| `/levels` | Browse, reorder, play, edit, delete levels (Dexie) |
| `/editor` | Create new level |
| `/editor?id=X` | Edit existing level X from Dexie DB |

## Architecture

### Client-only Pages

All pages that interact with the game or Dexie are `'use client'` components. The previous server-component pattern (passing level JSON as prop) is no longer used for Dexie-sourced levels. `useSearchParams` usage is always wrapped in `<Suspense>`.

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

### Cell Types & Behaviour

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

**Ice rules:** During a slide, lava edges act as walls (no death). Lava death only on the first intentional step. All intermediate ice cells' effects trigger (none in practice since intermediate cells are ice).

**Teleporter rules:** If the exit cell is occupied by a player, box, or obstacle → entity stays at the `teleporter_in` cell (no teleport this turn). Power cables (powered player trails) propagate through teleporters.

**Conveyor rules:** Conveyors may optionally require power (`conveyorPowerRequired` in `LevelData`). An unpowered required conveyor is inactive. Batch order-independent resolution with per-entity cycle detection.
- Player on conveyor reaching a box → chain push; if push fails, player stays (no overlap)
- Box on conveyor reaching a player → player is pushed 1 step; if player can't move, box stays (no overlap)
- Box on conveyor reaching another box → conveyor stops (no chain push from conveyors, only from player actions)

### Edge Behaviour

Each of the 4 edges is independently configured in the level JSON:
- `wall` — movement into that edge is blocked (object stays)
- `portal` — object wraps to the opposite edge (purple border `#9333ea`)
- `lava` — object tries to move beyond this edge → `phase = 'lost'` (reason: `'lava_edge'`), red border `#ef4444`

### Boxes (Sokoban mechanic)

Boxes are defined in `LevelData.initialBoxes` and tracked in `GameState.boxes` as `BoxState[]`.

- Players push boxes by moving into them; box slides 1 step in the same direction
- **Chain push:** pushing box A into box B moves both (recursively); whole chain fails if any box is blocked
- Two players pushing the same box (directly or via a shared chain) → conflict → both players stay, no boxes move
- `requiresPower: true` on a box → box can only be pushed when its cell is powered
- Box pushed onto `forbidden` or off a `lava` edge → silently destroyed (no game-over)
- Boxes slide on ice when pushed onto it
- Boxes can teleport through teleporters

**Teleporter exit collision (same turn):** Step 7 uses projected box positions (after the push computed in step 3) for exit occupancy. A box pushed to exit E this turn blocks a player from also teleporting to E in the same turn. Two players teleporting to the same exit in the same turn → both stay at `teleporter_in`.

**`computeBoxChainPush`** in `boxPhysics.ts` is the recursive chain push implementation; exported for use in `movement.ts` (player pushes) and `processConveyors` (conveyor carries player into box).

### Power System

- `power_node` cell: player stepping on it is added to `poweredPlayers: number[]`
- Powered players' trail positions are always tracked (regardless of `trailCollision`); trail renders an electric amber overlay
- `computePoweredCells` BFS: seeds = all `power_node` positions + all trail cells of powered players
- BFS extends through adjacent: conveyors in `conveyorPowerRequired`, boxes with `requiresPower: true`
- Teleporter propagation: powered `teleporter_in_X` → paired `teleporter_out_X` also powered; BFS continues from there

### Trail Collision (optional per level)

When `trailCollision: true` is set in `LevelData`:
- Trail positions are tracked in `GameState.trail`
- Trail overlays are rendered on the board (emerald for P1, sky for P2)
- Landing on the opponent's trail → `phase = 'lost'` (reason: `'trail'`)
- Objects can freely step on their **own** trail

When `trailCollision` is absent/false: no trail tracking, no trail rendering. Powered player trails are still tracked internally for the power system.

### GameState Shape

```typescript
{
  level: LevelData                     // immutable level config
  objects: GameObjectState[]           // mutable runtime state per object
  boxes: BoxState[]                    // pushable box positions
  poweredPlayers: number[]             // player IDs who stepped on power_node
  phase: 'playing' | 'won' | 'lost'
  moveCount: number
  trail: Record<number, Position[]>    // objectId → visited positions
  lostReason?: 'forbidden' | 'lava_edge' | 'trail'  // shown in LostOverlay
}
```

### GameShell Props

```typescript
interface GameShellProps {
  level: LevelData;
  onNextLevel?: () => void;  // if provided, "Next Level" button is shown in WinOverlay
}
```

`GameShell` no longer self-discovers next level from a static array. The parent (game page) handles Dexie lookup and passes the callback.

### Dexie Database (`app/src/lib/db.ts`)

**Schema (version 2):**
- `levels` table — `++id` (auto-increment). Stores `StoredLevel` objects.
- `levelOrder` table — single record `{ id: 1, order: number[] }` containing level IDs in display order.
- Version 2 added optional fields `initialBoxes` and `conveyorPowerRequired` to `StoredLevel`; no migration needed (old data still valid).

**Why separate order record?**
Inserting a level at any position only updates the one `levelOrder` record — no other level records are modified. Order is O(1) to change regardless of level count.

**Key helpers:**
```typescript
getOrderedLevels()               // → StoredLevel[] in display order
getNextLevelId(currentId)        // → next level's DB id, or null
saveLevelAtPosition(data, pos?)  // → new level id (0-based pos, undefined = append)
updateStoredLevel(id, data)      // updates a level in-place (keeps order)
deleteStoredLevel(id)            // removes from table + order array
reorderLevels(newOrder)          // replaces the order array
```

**Lazy singleton:** `getDB()` is called at runtime to avoid server-side instantiation.

### Level Editor (`/editor`)

Three-column layout (all within `100dvh`, sidebars scroll, center grid fixed):
- **Left panel:** Saved levels list (click to load for editing), "New Level" button
- **Center:** Tool palette (grouped: Basic, Ice, Power, Conveyors, Teleporters, Players, Boxes) + clickable grid with edge indicators
- **Right panel:** Level name, grid size, edges, options (trail collision + conveyor power requirements), object configs, boxes section, actions, JSON preview

**Painting behavior:**
- Click a cell with the same type as active tool → toggles to empty
- Drag always paints/erases following the action started on mousedown

**Save flow:**
- Editing existing (`?id=X`): "Update" button saves immediately
- New level: "Save" opens a dialog to choose insert position (1-based, blank = last)
- Validation: `generateLevelData` checks that every `teleporter_in_X` has a matching `teleporter_out_X` and vice versa; returns an error if any pair is incomplete

**Box placement:**
- "Add Box" button in palette → new box enters placement mode
- Click any grid cell to place the box; placement mode exits automatically
- Right panel Boxes section: shows each box's position, "Place" button to re-place, requiresPower toggle, remove button
- `BoxDot` overlay renders box position on the editor grid

**Conveyor power requirements:**
- Options section shows a checklist for every conveyor cell in the current grid
- Checked = that conveyor requires power to be active (`conveyorPowerRequired` in saved level)

### Level Order in `/levels`

Up/down arrow buttons reorder. Only the single `levelOrder` record in Dexie is updated per move — no level records are touched.

### Adding a Level via JSON

**Critical invariant:** `targets[i].position` must match the coordinates of the corresponding `target_1`/`target_2` cell in `grid`. A mismatch causes the win condition to trigger on wrong cells.

### Object IDs & Visual Mapping

- Object `id: 1` → neon emerald `#00ff88`, grid cell `target_1`
- Object `id: 2` → neon sky `#00c4ff`, grid cell `target_2`

### Neon Theme

Dark base `#030712`. Neon glows via `box-shadow` and `text-shadow` inline styles:
- Emerald (P1): `#00ff88`
- Sky (P2): `#00c4ff`
- Forbidden: `#ef4444`
- Direction toggle: `#ffd700`
- Portal edge: `#9333ea`
- Lava edge: `#ef4444`
- Ice: `#a5f3fc` (cyan-white)
- Power node: `#fbbf24` (amber)
- Conveyor: `#c4b5fd` (purple); dims when unpowered
- Teleporter A: `#ec4899` (pink), B: `#f97316` (orange), C: `#14b8a6` (teal)
- Box (GameBoxObject): `#f97316` orange neon border; dims when `requiresPower && !isPowered`
- Powered trail overlay: amber `rgba(251,191,36,0.08)` electric layer on top of base trail

### framer-motion Usage

`GameObject` uses `<motion.div animate={{ x, y }}>` with absolute positioning. `x = col * CELL_SIZE`, `y = row * CELL_SIZE`. Spring config: `stiffness: 400, damping: 30`. `WinOverlay` and `LostOverlay` use `AnimatePresence` with scale+opacity transitions.

### Mobile Controls

`GameShell` renders a D-pad below the board (9-cell grid: ↑ ← · → ↓). Uses `onPointerDown` to support both touch and mouse.
