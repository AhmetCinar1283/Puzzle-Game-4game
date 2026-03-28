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
        └── processMoveStep (pure)
              ├── computeNewPosition × N objects (order-independent batch)
              ├── addToTrail (if trailCollision enabled)
              ├── applyMoveToObject (toggle mode, lock on target)
              └── checkWinCondition / forbidden / lava_edge / trail check → phase
```

All game logic lives in `app/src/games/logic/` as pure functions with no React dependency.

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

### Edge Behaviour

Each of the 4 edges is independently configured in the level JSON:
- `wall` — movement into that edge is blocked (object stays)
- `portal` — object wraps to the opposite edge (purple border `#9333ea`)
- `lava` — object tries to move beyond this edge → `phase = 'lost'` (reason: `'lava_edge'`), red border `#ef4444`

### Trail Collision (optional per level)

When `trailCollision: true` is set in `LevelData`:
- Trail positions are tracked in `GameState.trail`
- Trail overlays are rendered on the board (emerald for P1, sky for P2)
- Landing on the opponent's trail → `phase = 'lost'` (reason: `'trail'`)
- Objects can freely step on their **own** trail

When `trailCollision` is absent/false: no trail tracking, no trail rendering.

### GameState Shape

```typescript
{
  level: LevelData                     // immutable level config
  objects: GameObjectState[]           // mutable runtime state per object
  phase: 'playing' | 'won' | 'lost'
  moveCount: number
  trail: Record<number, Position[]>    // objectId → visited positions (only populated if trailCollision)
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

**Schema (version 1):**
- `levels` table — `++id` (auto-increment). Stores `StoredLevel` objects.
- `levelOrder` table — single record `{ id: 1, order: number[] }` containing level IDs in display order.

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
- **Center:** Tool palette + clickable grid with edge indicators
- **Right panel:** Level name, grid size, edges, options, object configs, actions, JSON preview

**Painting behavior:**
- Click a cell with the same type as active tool → toggles to empty
- Drag always paints/erases following the action started on mousedown

**Save flow:**
- Editing existing (`?id=X`): "Update" button saves immediately
- New level: "Save" opens a dialog to choose insert position (1-based, blank = last)

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

### framer-motion Usage

`GameObject` uses `<motion.div animate={{ x, y }}>` with absolute positioning. `x = col * CELL_SIZE`, `y = row * CELL_SIZE`. Spring config: `stiffness: 400, damping: 30`. `WinOverlay` and `LostOverlay` use `AnimatePresence` with scale+opacity transitions.

### Mobile Controls

`GameShell` renders a D-pad below the board (9-cell grid: ↑ ← · → ↓). Uses `onPointerDown` to support both touch and mouse.
